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
  host: false
}

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
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
  }});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if(changeInfo.url) {  
    applyRulesForTab(tab)
  }
});

const movePromise = (id, index) => (
  new Promise(function(resolve, reject) {
    console.log("moving tab to index : ", index);
    chrome.tabs.move(id, { index }, () => resolve());
  })
);

const updatePromise = (id, data) => (
  new Promise(function(resolve, reject) {
    console.log("updating tab", id, data);
    chrome.tabs.update(parseInt(id), data, (t) => resolve());
  })
);


const applyRulesForTab = (tab) => {
  console.log("apply rules for tab", tab);

  console.log(config)

  promiseSerial([
    removeDuplicates(tab),
    trimTabs(tab),
    moveSameUrlHost(tab),
  ])
}

const moveSameUrlHost = (tab) => (
  new Promise(function(resolve, reject) {
    if(!config.group) {
      resolve();
      return;
    }

    const url = new URL(tab.url);
    var hostQuery = url.origin + "/*";

    chrome.tabs.query({url: hostQuery, currentWindow: true}, function(tabs) {
      groupVivaldiTabsPromise(tabs).then( () => resolve())
    });
  })
);

const moveTabsPromise = (tabs) => {
  const firstIndex = tabs[0].index;
  const movePromises = tabs.map(((t, index) => movePromise(t.id, firstIndex + index)))
  return promiseSerial(movePromises)
}

const groupVivaldiTabsPromise = (tabs) => {
  const tabsToExtData = tabs.reduce( (old, curr) => {
      var data = {}
      try { data = JSON.parse(curr.extData) } catch(e) {}

      return {
        ...old,
        [parseInt(curr.id)]: data
      } 
    }, {})

  const existingGroupId = Object.values(tabsToExtData)
  .map(d => d.group)
  .find(g => g);
  
  var groupIdToUse = existingGroupId ? existingGroupId : uuidv4()

  if(tabs.length === 1) {
    groupIdToUse = null
  }

  const updatePromises = Object.keys(tabsToExtData).map((tabId => {
    const newExtData = tabsToExtData[tabId]
    newExtData.group = groupIdToUse

    return updatePromise(tabId, { extData : JSON.stringify(newExtData) } );
  }))
  return promiseSerial(updatePromises)
}

const removeDuplicates = (tab) => (
  new Promise(function(resolve, reject) {
    if(!config.duplicates) {
      resolve();
      return;
    }

    chrome.tabs.query({}, function(allTabs) {
      const tabs = allTabs.filter( t => t.url == tab.url)
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

    const maxAllowed = 5

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
