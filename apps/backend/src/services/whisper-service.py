import argparse
import json
import sys
import whisper


def main():
    parser = argparse.ArgumentParser(description="Whisper speech-to-text transcription")
    parser.add_argument("--model", default="turbo", help="Whisper model name (default: turbo)")
    parser.add_argument("--audio", required=True, help="Path to the audio file")
    args = parser.parse_args()

    try:
        # Load the whisper model
        model = whisper.load_model(args.model)

        # Load audio and pad/trim it to fit 30 seconds
        audio = whisper.load_audio(args.audio)
        audio = whisper.pad_or_trim(audio)

        # Make log-Mel spectrogram and move to the same device as the model
        mel = whisper.log_mel_spectrogram(audio, n_mels=model.dims.n_mels).to(model.device)

        # Detect the spoken language
        _, probs = model.detect_language(mel)
        detected_language = max(probs, key=probs.get)

        # Decode the audio
        options = whisper.DecodingOptions()
        result = whisper.decode(model, mel, options)

        # Output JSON result
        output = {
            "text": result.text,
            "language": detected_language
        }
        print(json.dumps(output))

    except Exception as e:
        error_output = {
            "error": str(e)
        }
        print(json.dumps(error_output), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
