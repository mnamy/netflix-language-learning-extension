// Opens the local My Words page from the toolbar button.

chrome.action.onClicked.addListener(function () {
  chrome.tabs.create({
    url: chrome.runtime.getURL("words.html"),
  });
});
