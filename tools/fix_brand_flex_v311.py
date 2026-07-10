from pathlib import Path

server_path = Path(__file__).resolve().parents[1] / "server.js"
source = server_path.read_text(encoding="utf-8")
old = "function brandStoryReply() {\n  return mascotBubble("
if old not in source:
    raise RuntimeError("brandStoryReply anchor missing")
source = source.replace(old, "function brandStoryBubble() {\n  return mascotBubble(", 1)
anchor = "\nfunction detectProduct(text) {"
wrapper = '''
function brandStoryReply() {
  return {
    type: "flex",
    altText: "仙加味品牌故事",
    contents: brandStoryBubble(),
  };
}
'''
if anchor not in source:
    raise RuntimeError("detectProduct anchor missing")
source = source.replace(anchor, wrapper + anchor, 1)
server_path.write_text(source, encoding="utf-8")

test_path = server_path.parent / "test.js"
test = test_path.read_text(encoding="utf-8")
test = test.replace(
    "brandStoryReply().body.contents[1].text",
    "brandStoryReply().contents.body.contents[1].text",
)
test_path.write_text(test, encoding="utf-8")
print("brand story Flex reply fixed")
