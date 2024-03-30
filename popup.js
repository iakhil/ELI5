document.addEventListener('DOMContentLoaded', function() {
    var eli5Button = document.getElementById('eli5Button');
    var explanationDiv = document.getElementById('explanation');
  
    eli5Button.addEventListener('click', function() {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.tabs.executeScript(tabs[0].id, { code: "window.getSelection().toString();" }, function(selection) {
          var highlightedText = selection[0];
          if (highlightedText.trim() !== '') {
            explanationDiv.innerText = 'Generating explanation...';
            chrome.runtime.sendMessage({ text: highlightedText }, function(response) {
              if (response && response.explanation && response.explanation.choices && response.explanation.choices[0]) {
                var explanation = response.explanation.choices[0].message.content.trim();
                explanationDiv.innerText = explanation;
              } else {
                explanationDiv.innerText = 'Failed to generate explanation. Please try again.';
              }
            });
          } else {
            explanationDiv.innerText = 'Please highlight some text on the page.';
          }
        });
      });
    });
  });