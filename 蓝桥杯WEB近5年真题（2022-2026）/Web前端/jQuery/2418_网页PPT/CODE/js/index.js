const sectionsCount = $("section").length;
let activeIndex = 0;

// 监听用户按下空格和方向键的事件
$(document).on("keydown", (e) => {
  e.preventDefault();
  if (e.key === " " || e.key === "ArrowRight") {
    goRight();
  }
  if (e.key === "ArrowLeft") {
    goLeft();
  }
});

// 监听按钮点击事件
$(".btn.left").click(goLeft);
$(".btn.right").click(goRight);

// 切换下一张的函数
function goLeft() {
  if (activeIndex === 0) {
    return;
  }
  activeIndex -= 1;
  switchPage();
}

// 切换上一张的函数
function goRight() {
  if (activeIndex === sectionsCount - 1) {
    return;
  }
  activeIndex += 1;
  switchPage();
}

function switchPage() {
  // TODO: 请补充该函数，实现根据activeIndex切换页面的功能，并且在到达最后一页或第一页时给相应的按钮添加disable类
}
