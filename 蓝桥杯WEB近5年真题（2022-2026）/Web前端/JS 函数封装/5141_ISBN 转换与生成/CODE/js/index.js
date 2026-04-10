// 将用户输入的带分隔符的 isbn 字符串转换只有纯数字和大写 X 字母的字符串
// 入参 str 为转换为包含任意字符的字符串
function getNumbers(str) {
  // TODO: 待补充代码
}

// 验证当前 ISBN10 字符串是否有效
// 入参 str 为待判断的只有纯数字和大写 X 字母的字符串
function validISBN10(str) {
  // TODO: 待补充代码
}

// 将用户输入的 ISBN-10 字符串转化为 ISBN-13 字符串
// 入参 isbn 为有效的 ISBN-10 字符串
function ISBN10To13(isbn) {
  // TODO: 待补充代码
}

// 测试用例
console.log(getNumbers("7-5600-3879-4")); // 7560038794
console.log(getNumbers("7 5600 3879 4")); // 7560038794

console.log(validISBN10("7560038794")); // true
console.log(validISBN10("7560038793")); // false
console.log(validISBN10("756003879")); // false
console.log(validISBN10("756003879004")); // false

console.log(ISBN10To13("7560038794")); // 9787560038797
console.log(ISBN10To13("3598215088")); // 9783598215087
