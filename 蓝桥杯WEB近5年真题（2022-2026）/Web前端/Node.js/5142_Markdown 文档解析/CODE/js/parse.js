class Parser {
  constructor() {
    this.heading = /^(#{1,6}\s+)/;
    this.blockQuote = /^(\>\s+)/;
    this.unorderedList = /^((\*|-){1}\s+)/;
    this.image = /\!\[(.*?)\]\((.*?)\)/g;
    this.strongText = /\*{2}(.*?)\*{2}/g;
    this.codeLine = /\`{1}(.*?)\`{1}/g;
    // TODO: 补充分割符正则
    this.hr = /TODO/;
  }
  
  // 获取单行内容
  parseLineText(lineText) {
    this.lineText = lineText;
  }

  // 是否是空行
  isEmptyLine() {
    return this.lineText === "";
  }

  // 是否为符合标题规范
  isHeading() {
    return this.heading.test(this.lineText);
  }

  // 解析标题
  parseHeading() {
    const temp = this.lineText.split(" ");
    const headingLevel = temp[0].length;
    const title = temp[1].trim();
    return `<h${headingLevel}>${title}</h${headingLevel}>`;
  }

  /**
   * TODO: 请完成剩余各种语法的解析
   *   1. 完成对分隔符的解析
   *   2. 完成对引用区块的解析
   *   3. 完成对图片，和文字效果的解析
   *   4. 完成对无序列表的解析
   */
}

class Reader {
  constructor(text) {
    //获取全部原始文本
    this.text = text;
    this.lines = this.getLines();
    this.parser = new Parser();
  }

  runParser() {
    let currentLine = 0;
    let hasParsed = [];

    while (!this.reachToEndLine(currentLine)) {
      // 获取行文本
      this.parser.parseLineText(this.getLineText(currentLine));

      // 判断空白行
      if (this.parser.isEmptyLine()) {
        currentLine++;
        continue;
      }

      if (this.parser.isHeading()) {
        hasParsed.push(this.parser.parseHeading());
        currentLine++;
        continue;
      }
      // TODO: 请完成剩余各种语法的解析

      currentLine++;
    }
    return hasParsed.join("");
  }

  getLineText(lineNum) {
    return this.lines[lineNum];
  }

  getLines() {
    this.lines = this.text.split("\n");
    return this.lines;
  }

  reachToEndLine(line) {
    return line >= this.lines.length;
  }
}

module.exports = function parseMarkdown(markdownContent) {
  return new Reader(markdownContent).runParser();
};
