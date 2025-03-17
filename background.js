const OPENAI_API_KEY = ''


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.text) {
    generateELI5Explanation(request.text, function(response) {
      sendResponse({ explanation: response });
    });
    return true; // Required to use sendResponse asynchronously
  }
});

function generateELI5Explanation(text, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://api.openai.com/v1/chat/completions", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.setRequestHeader("Authorization", "Bearer " + OPENAI_API_KEY);

  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        var response = JSON.parse(xhr.responseText);
        callback(response);
      } else {
        callback(null);
      }
    }
  };
  
    var requestData = {
        "model": "gpt-3.5-turbo",
        "messages": [
          {
            "role": "system",
            "content": "You are an expert teacher who can explain complex concepts easily. Jump straight to the explanation, don't include any other text."
          },
          {
            "role": "user",
            "content": "ELI5 the following text: " + text
          }
        ]
      }
    xhr.send(JSON.stringify(requestData));
  }