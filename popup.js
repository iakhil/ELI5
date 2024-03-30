document.addEventListener('DOMContentLoaded', function() {
  var eli5Button = document.getElementById('eli5Button');
  var explanationDiv = document.getElementById('explanation');

  eli5Button.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.executeScript(tabs[0].id, { code: "window.getSelection().toString();" }, function(selection) {
        var highlightedText = selection[0];
        // Here, you can call an API or use a library to simplify the highlighted text
        var eli5Explanation = "Imagine " + highlightedText + " is like a big, fun adventure!";
        explanationDiv.innerText = eli5Explanation;
      });
    });
  });
});