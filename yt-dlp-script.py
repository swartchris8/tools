# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "click",
#     "yt-dlp",
# ]
# ///

import click
import yt_dlp
import sys
from pathlib import Path


def get_video_info(url):
    """Fetch video information without downloading."""
    with yt_dlp.YoutubeDL({"quiet": True}) as ydl:
        try:
            return ydl.extract_info(url, download=False)
        except Exception as e:
            click.echo(f"Error fetching video info: {e}", err=True)
            sys.exit(1)


@click.command()
@click.argument("url")
@click.option(
    "-o",
    "--output-dir",
    type=click.Path(file_okay=False, path_type=Path),
    default=".",
    help="Directory to save the video",
)
@click.option(
    "-f",
    "--format",
    default="best",
    help="Video format to download (e.g., 'best', '720p', 'bestvideo+bestaudio')",
)
@click.option("--audio-only", is_flag=True, help="Download audio only")
def download(url: str, output_dir: Path, format: str, audio_only: bool):
    """Download a video from YouTube or other supported platforms.
    
    URL: The video URL to download from.
    """
    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Configure yt-dlp options
    ydl_opts = {
        "format": "bestaudio/best" if audio_only else format,
        "outtmpl": str(output_dir / "%(title)s.%(ext)s"),
        "progress_hooks": [lambda d: click.echo(f"Downloading: {d['_percent_str']}")],
    }

    if audio_only:
        ydl_opts.update({
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
            }]
        })

    # Show video info before downloading
    info = get_video_info(url)
    click.echo(f"\nTitle: {info['title']}")
    click.echo(f"Duration: {info['duration_string']}")
    click.echo(f"Format selected: {'audio-only (mp3)' if audio_only else format}")
    
    if not click.confirm("\nProceed with download?"):
        click.echo("Download cancelled.")
        return

    # Download the video
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        click.echo("\nDownload completed successfully!")
    
    except Exception as e:
        click.echo(f"Error downloading video: {e}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    download()
