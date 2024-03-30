chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    id: "eli5Context",
    title: "Explain Like I'm Five",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === "eli5Context") {
    var highlightedText = info.selectionText;
    var eli5Explanation = "Imagine " + highlightedText + " is like a big, fun adventure!";

    chrome.tabs.executeScript(tab.id, {
      code: 'var explanationDiv = document.createElement("div");' +
            'explanationDiv.id = "eli5Explanation";' +
            'explanationDiv.style.position = "fixed";' +
            'explanationDiv.style.bottom = "10px";' +
            'explanationDiv.style.right = "10px";' +
            'explanationDiv.style.backgroundColor = "lightblue";' +
            'explanationDiv.style.padding = "10px";' +
            'explanationDiv.style.borderRadius = "5px";' +
            'explanationDiv.style.zIndex = "9999";' +
            'explanationDiv.innerText = "' + eli5Explanation.replace(/"/g, '\\"') + '";' +
            'document.body.appendChild(explanationDiv);'
    });
  }
});