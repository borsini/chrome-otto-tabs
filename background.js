'use strict';

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

const promiseSerial = funcs =>
  funcs.reduce((promise, func) =>
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

/* Promises helpers */

const movePromise = (id, index) => (
  new Promise(function(resolve, reject) {
    console.log("moving tab to index : ", index);
    chrome.tabs.move(id, { index }, () => resolve());
  })
);

const moveTabsPromise = (tabs) => {
  console.log("move tabs...")
  const firstIndex = tabs[0].index;
  const movePromises = tabs.map(((t, index) => () => movePromise(t.id, firstIndex + index)))
  return promiseSerial(movePromises)
    .then( () => Promise.resolve(tabs))
}

const updatePromise = (id, data) => (
  new Promise(function(resolve, reject) {
    console.log("updating tab", id, data);
    chrome.tabs.update(parseInt(id), data, (t) => resolve());
  })
);

const removePromise = (id) => (
  new Promise(function(resolve, reject) {
    console.log("removing tab", id);
    chrome.tabs.remove(parseInt(id),  () => { console.log("removed");resolve(); });
  })
);

const queryPromise = (query) => (
  new Promise(function(resolve, reject) {
    console.log("querying tabs ", query);
    chrome.tabs.query(query, resolve);
  })
);

/********************/

const applyRulesForTab = (tab) => {
  console.log("apply rules for tab", tab);

  console.log(config)

  
  promiseSerial([
    () => removeDuplicates(tab),
    () => trimTabs(tab),
    () => moveSameUrlHost(tab),
  ])
}

const moveSameUrlHost = (tab) => (
  new Promise(function(resolve, reject) {
    console.log("Group tabs...")

    if(!config.group) {
      resolve();
      return;
    }

    const url = new URL(tab.url);
    var hostQuery = url.origin + "/*";

    queryPromise({url: hostQuery, currentWindow: true, pinned: false})
    .then(moveTabsPromise)
    .then( tabs => {
      if(tab.extData != undefined) { //Vivaldi stacking feature is supported
        return groupVivaldiTabsPromise(tabs)
      } else {
        return Promise.resolve()
      }
    })
    .then( () => resolve())
  })
);

const groupVivaldiTabsPromise = (tabs) => {
  console.log("group vivaldi tabs...")

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

    return () => updatePromise(tabId, { extData : JSON.stringify(newExtData) } );
  }))
  return promiseSerial(updatePromises)
}

const removeDuplicates = (tab) => (
  new Promise(function(resolve, reject) {
    console.log("Removing duplicates...")
    if(!config.duplicates) {
      resolve();
      return;
    }

    queryPromise({ currentWindow: true, pinned: false })
    .then(allTabs => {
      const tabs = allTabs.filter( t => t.url == tab.url && t.id != tab.id)
      console.log(tabs.length, "identical tabs to tab id ", tab.id, " : ", tabs)
      if(tabs.length > 0) {
        console.log("remove tabs ", tabs)
        return promiseSerial(tabs.map(t => () => removePromise(t.id)))
      } else {
        return Promise.resolve()
      }
    })
    .then(resolve);
  })
);

const trimTabs = (tab) => (
  new Promise(function(resolve, reject) {
    console.log("Trimming tabs...")

    if(!config.host) {
      resolve();
      return;
    }

    const maxAllowed = 5

    const url = new URL(tab.url);
    var hostQuery = url.origin + "/*";

    queryPromise({url: hostQuery, currentWindow: true, pinned: false})
    .then( tabs => {
      console.log(tabs.length, "tabs avec le même host")
      if(tabs.length > maxAllowed) {
        const toRemove = tabs.filter(t => t.id != tab.id).slice(0, tabs.length - maxAllowed);
        console.log("trim tab ", toRemove)
        return promiseSerial(toRemove.map(t => () => removePromise(t.id)))
      } else {
        return Promise.resolve()
      }
    })
    .then(resolve);
  })
);
