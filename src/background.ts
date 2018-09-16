interface RulesConfig {
  duplicates: {
    isActivated: boolean,
  }
  group: {
    isActivated: boolean,
  }
  host: {
    isActivated: boolean,
  }
}

var config: RulesConfig = {
  duplicates: {
    isActivated: true,
  },
  group: {
    isActivated: true,
  },
  host: {
    isActivated: true,
  }
}

interface VivaldiTab extends chrome.tabs.Tab {
  readonly extData: string;
}


interface VivaldiUpdateProperties extends chrome.tabs.UpdateProperties {
  extData?: string;
}


const isVivaldiTab = (object: any): object is VivaldiTab => {
  return object && 'extData' in object;
};

const MAX_TABS_ALLOWED_WITH_SAME_HOST = 5

function uuidv4(): string {
  return (""+1e7+-1e3+-4e3+-8e3+-1e11)
  .replace(/[018]/g, c => (c as any ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> (c as any) / 4)
  .toString(16)
  )
}

const promiseSerial = (funcs : Array<() => Promise<any>>) =>
  funcs.reduce((promise, func) =>
  promise.then(result => func().then(Array.prototype.concat.bind(result))),
  Promise.resolve([]))

chrome.runtime.onMessage.addListener(function(message, _, sendResponse) {
  if(message == 'GET_CONFIG') {
    console.log('get config received')
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
const movePromise = (id: number, index: number): Promise<chrome.tabs.Tab[]> => (
  new Promise(function(resolve, reject) {
    console.log("moving tab to index : ", index);
    chrome.tabs.move(id, { index }, () => resolve());
  })
);

const moveTabsPromise = (tabs: chrome.tabs.Tab[]): Promise<chrome.tabs.Tab[]> => {
  if(tabs.length < 2) {
    console.log("no need to move", tabs.length, "tabs")
    return Promise.resolve(tabs)
  }

  console.log("move tabs...", tabs)
  const firstIndex = tabs[0].index;
  const movePromises = tabs
    .filter(t => t.id !== undefined)
    .map(((t, index) => () => movePromise(t.id!, firstIndex + index)))
  return promiseSerial(movePromises)
    .then( () => Promise.resolve(tabs))
}

const updatePromise = (tabId: number, data: chrome.tabs.UpdateProperties | VivaldiUpdateProperties): Promise<any> => (
  new Promise(function(resolve, reject) {
    console.log("updating tab", tabId, data);
    chrome.tabs.update(tabId, data, (t) => resolve());
  })
);

const removePromise = (tabId: number): Promise<any> => (
  new Promise(function(resolve, reject) {
    console.log("removing tab", tabId);
    chrome.tabs.remove(tabId,  () => { console.log("removed");resolve(); });
  })
);

const queryPromise = (query: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> => (
  new Promise(function(resolve, reject) {
    console.log("querying tabs ", query);
    chrome.tabs.query(query, resolve);
  })
);

/********************/

const applyRulesForTab = (tab: chrome.tabs.Tab) => {
  console.log("apply otto rules for tab", tab);  
  promiseSerial([
    () => removeDuplicates(tab),
    () => trimTabs(tab),
    () => moveSameUrlHost(tab),
  ])
}

const moveSameUrlHost = (tab: chrome.tabs.Tab | VivaldiTab) => (
  new Promise(function(resolve, reject) {
    if(!config.group || !tab.url) {
      resolve();
      return;
    }

    console.log("Group tabs...")

    const url = new URL(tab.url);
    var hostQuery = url.origin + "/*";

    queryPromise({url: hostQuery, currentWindow: true, pinned: false})
    .then(moveTabsPromise)
    .then( tabs => {
      if(isVivaldiTab(tab)) { //Vivaldi stacking feature is supported
        return groupVivaldiTabsPromise(tabs as VivaldiTab[])
      } else {
        return Promise.resolve()
      }
    })
    .then( () => resolve())
  })
);

const groupVivaldiTabsPromise = (tabs: VivaldiTab[]) => {
  console.log("group vivaldi tabs...")

  const tabsToExtData: { [k: number]: { group: string | null} } = tabs
    .filter(t => t.id !== undefined)
    .reduce( (old, curr) => {
        var data = {}
        try { data = JSON.parse(curr.extData) } catch(e) {}

        return {
          ...old,
          [curr.id!]: data
        } 
      }, {}
    )

  var groupIdToUse : string | null = null
  if(tabs.length > 1) {
    const existingGroupId = Object.values(tabsToExtData)
    .map(d => d.group)
    .find(g => g !== undefined);
    groupIdToUse = existingGroupId ? existingGroupId : uuidv4()
    console.log("group id to use", groupIdToUse)
  } else {
    console.log("only one tab, remove it's group id")
  }

  const updatePromises = Object.keys(tabsToExtData).map(t => parseInt(t)).map((tabId => {
    const newExtData = tabsToExtData[tabId]
    newExtData.group = groupIdToUse

    return () => updatePromise(tabId, { extData : JSON.stringify(newExtData) } );
  }))
  return promiseSerial(updatePromises)
}

const removeDuplicates = (tab: chrome.tabs.Tab) => (
  new Promise(function(resolve, reject) {
    if(!config.duplicates) {
      resolve();
      return;
    }

    console.log("Removing duplicates...")

    queryPromise({ currentWindow: true, pinned: false })
    .then(allTabs => {
      const tabs = allTabs.filter( t => t.id !== undefined && t.url == tab.url && t.id != tab.id)
      console.log(tabs.length, "identical tabs to tab id ", tab.id, " : ", tabs)
      if(tabs.length > 0) {
        console.log("remove tabs ", tabs)
        return promiseSerial(tabs.map(t => () => removePromise(t.id!)))
      } else {
        return Promise.resolve()
      }
    })
    .then(resolve);
  })
);

const trimTabs = (tab: chrome.tabs.Tab) => (
  new Promise(function(resolve, reject) {
    if(!config.host || !tab.url) {
      resolve();
      return;
    }

    console.log("Trimming tabs...")

    const url = new URL(tab.url);
    var hostQuery = url.origin + "/*";

    queryPromise({url: hostQuery, currentWindow: true, pinned: false})
    .then( tabs => {
      console.log(tabs.length, "tabs with same host")
      if(tabs.length > MAX_TABS_ALLOWED_WITH_SAME_HOST) {
        const toRemove = tabs
          .filter(t => t.id !== undefined && t.id != tab.id)
          .slice(0, tabs.length - MAX_TABS_ALLOWED_WITH_SAME_HOST);

        console.log("trim tab ", toRemove)
        return promiseSerial(toRemove.map(t => () => removePromise(t.id!)))
      } else {
        return Promise.resolve()
      }
    })
    .then(resolve);
  })
);
