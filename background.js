// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// A rule
// host (all, specific)
// behavior (group, remove dups, trim, pin, archive)

var config = {
  duplicates: true,
  group: true,
  host: true
}

const promiseSerial = promises =>
  promises.map(p => () => p)
    .reduce((promise, func) =>
      promise.then(result => func().then(Array.prototype.concat.bind(result))),
      Promise.resolve([]))

chrome.runtime.onMessage.addListener(function(message, send, sendResponse) {
  if(message == 'GET_CONFIG') {
    sendResponse(config)
  } else {
    console.log('new config', message)
    config = message
  }
});


chrome.commands.onCommand.addListener(function(command) {
  if (command == "toggle-pin") {
    // Get the currently selected tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Toggle the pinned status
      var current = tabs[0]
      chrome.tabs.update(current.id, {'pinned': !current.pinned});
    });
  }
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if(changeInfo.url) {  
    applyRulesForTab(tab)
  }
});

const movePromise = (id, index) => (
  new Promise(function(resolve, reject) {
    console.log("moving tab to index : ", index)
    chrome.tabs.move(id, { index }, () => resolve());
  })
);

const applyRulesForTab = (tab) => {
  console.log("apply rules for tab", tab);

  console.log(config)

  groupSameUrlHost(tab)
    .then(removeDuplicates(tab))
    .then(trimTabs(tab));
}

const groupSameUrlHost = (tab) => (
  new Promise(function(resolve, reject) {
    if(!config.group) {
      resolve();
      return;
    }

    const url = new URL(tab.url);
    var hostQuery = url.origin + "/*";

    chrome.tabs.query({url: hostQuery, currentWindow: true}, function(tabs) {
      const firstIndex = tabs[0].index;
      const movePromises = tabs.map(((t, index) => movePromise(t.id, firstIndex + index)))
      promiseSerial(movePromises).then( () => resolve())
    });
  })
);

const removeDuplicates = (tab) => (
  new Promise(function(resolve, reject) {
    if(!config.duplicates) {
      resolve();
      return;
    }

    chrome.tabs.query({url: tab.url, currentWindow: true}, function(tabs) {
      console.log(tabs.length, "identical tabs")
      if(tabs.length > 1) {
        const toRemove = tabs.filter(t => t.id != tab.id);
        console.log("remove tabs ", toRemove)
        chrome.tabs.remove(toRemove.map(t => t.id)), function() {
          resolve();
        }
      } else {
        resolve();
      }
    });
  })
);

const trimTabs = (tab) => (
  new Promise(function(resolve, reject) {
    if(!config.host) {
      resolve();
      return;
    }

    const maxAllowed = 2

    const url = new URL(tab.url);
    var hostQuery = url.origin + "/*";

    chrome.tabs.query({url: hostQuery, currentWindow: true}, function(tabs) {
      console.log(tabs.length, "tabs avec le même host")
      if(tabs.length > maxAllowed) {
        const toRemove = tabs.filter(t => t.id != tab.id).slice(0, tabs.length - maxAllowed);
        console.log("trim tab ", toRemove)
        
        chrome.tabs.remove(toRemove.map(t => t.id),  function() { 
          resolve();
        })

      } else {
        resolve();
      }
    });
  })
);
