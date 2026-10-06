// Opens the account hub from the toolbar button.

chrome.action.onClicked.addListener(function () {
  chrome.tabs.create({
    url: chrome.runtime.getURL("words.html"),
  });
});
