from pathlib import Path

path = Path(__file__).resolve().parents[1] / "test.js"
text = path.read_text(encoding="utf-8")
text = text.replace('"小老闆搭配導覽"', '"日常搭配導覽"')
path.write_text(text, encoding="utf-8")
