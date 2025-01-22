# /// script
# requires-python = ">=3.11,<3.12"
# dependencies = [
#     "click",
#     "faster-whisper",
#     "pydub",
# ]
# ///

import os
import tempfile
import time
from pathlib import Path
import click
from pydub import AudioSegment
from faster_whisper import WhisperModel

# Supported formats by pydub
SUPPORTED_FORMATS = {
    '.mp3': 'mp3',
    '.m4a': 'm4a',
    '.mp4': 'mp4',
    '.wav': 'wav',
    '.flac': 'flac',
    '.ogg': 'ogg',
    '.aac': 'aac',
    '.wma': 'wma',
    '.aiff': 'aiff',
}

def format_time(milliseconds):
    """Convert milliseconds to human readable time"""
    seconds = milliseconds / 1000
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    
    if hours > 0:
        return f"{int(hours)}h {int(minutes)}m {int(seconds)}s"
    elif minutes > 0:
        return f"{int(minutes)}m {int(seconds)}s"
    else:
        return f"{int(seconds)}s"

@click.command()
@click.argument('input_path', type=click.Path(exists=True))
@click.option('--model', default='base', 
              type=click.Choice(['tiny', 'base', 'small', 'medium', 'large']),
              help='Whisper model to use for transcription')
@click.option('--output', '-o', type=click.Path(),
              help='Output file path (default: input_name.txt)')
def transcribe(input_path: str, model: str, output: str | None):
    """Transcribe audio/video file using Whisper.
    
    Supported formats: MP3, M4A, MP4, WAV, FLAC, OGG, AAC, WMA, AIFF
    """
    input_path = Path(input_path)
    input_format = input_path.suffix.lower()
    
    if input_format not in SUPPORTED_FORMATS:
        supported = ', '.join(SUPPORTED_FORMATS.keys())
        raise click.BadParameter(
            f"Unsupported file format: {input_format}\n"
            f"Supported formats are: {supported}"
        )
    
    if not output:
        output = input_path.with_suffix('.txt')
    
    # Show spinner while loading model
    with click.progressbar(
        range(1),
        label=f'Loading {model} model',
        fill_char='█',
        empty_char='░'
    ) as bar:
        whisper_model = WhisperModel(model)
        bar.update(1)
    
    try:
        start_time = time.time()
        
        # Process audio with spinner
        click.echo("Processing audio...")
        audio = AudioSegment.from_file(
            input_path,
            format=SUPPORTED_FORMATS[input_format]
        )
        duration = len(audio)  # in milliseconds
        
        with tempfile.NamedTemporaryFile(suffix='.wav') as temp_audio:
            audio.export(temp_audio.name, format="wav")
            
            # Transcribe with spinner
            click.echo("Transcribing audio... (this may take a while)")
            segments, info = whisper_model.transcribe(temp_audio.name, log_progress=True)
            text = ' '.join([segment.text for segment in segments])
        
        # Write transcription to file
        click.echo("Writing transcription...")
        with open(output, 'w', encoding='utf-8') as f:
            f.write(text)
        
        # Calculate elapsed time
        elapsed_time = time.time() - start_time
        elapsed_str = format_time(elapsed_time * 1000)  # Convert to milliseconds
        duration_str = format_time(duration)
        
        # Print completion message with timing info
        click.echo(click.style("\n✨ Transcription complete! ✨", fg='green'))
        click.echo(f"Audio duration: {duration_str}")
        click.echo(f"Processing time: {elapsed_str}")
        click.echo(f"Speed ratio: {duration/(elapsed_time * 1000):.1f}x real-time")
        
    except Exception as e:
        raise click.ClickException(
            f"Error processing audio: {str(e)}\n"
            "Make sure you have the necessary codecs installed "
            "(try installing ffmpeg)"
        )

if __name__ == '__main__':
    transcribe()
