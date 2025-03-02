import {
  applyRulesForTab,
  RulesConfig
} from './tabs_helpers.js'

var config: RulesConfig = {
  duplicates: {
    isActivated: true,
  },
  group: {
    isActivated: true,
    type: "FULL_DOMAIN"
  },
  host: {
    isActivated: false,
    maxTabsAllowed: 5,
  }
}

chrome.runtime.onMessage.addListener(function(message, _, sendResponse) {
  if(message == 'GET_CONFIG') {
    console.log('get config received')
    sendResponse(config)
  } else {
    console.log('new config', message)
    config = message

    //Sync config to chrome storage
    chrome.storage.sync.set({'config': config}, function() {
      console.log('Config has been synced', config);
    });

  }});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  console.log("TabChangeInfo", changeInfo)
  if(changeInfo.url) {  
    console.log("Url has changed, let's Otto rule!")
    applyRulesForTab(tab, config)
  }
});

chrome.storage.sync.get(['config'], function(result) {
  const conf = result.config
  console.log('Retrieved config is', conf);

  if(conf !== undefined) {
    config = result.config
    chrome.runtime.sendMessage('', 'NEW_CONFIG')
  }
});