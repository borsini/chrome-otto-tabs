
export interface RulesConfig {
    duplicates: {
      isActivated: boolean,
    }
    group: {
      isActivated: boolean,
      type: "FULL_DOMAIN" | "SUB_DOMAIN"
    }
    host: {
      isActivated: boolean,
      maxTabsAllowed: number,
    }
  }
  
  interface VivaldiTab extends chrome.tabs.Tab {
    readonly vivExtData: string;
  }
  
  
  interface VivaldiUpdateProperties extends chrome.tabs.UpdateProperties {
    vivExtData?: string;
  }
 
export type RemovePromise = (tabId: number) => Promise<any>
export type UpdatePromise = (tabId: number, data: chrome.tabs.UpdateProperties | VivaldiUpdateProperties) => Promise<any>
export type QueryPromise = (query: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>
export type RegroupTabsPromise = (tabs: chrome.tabs.Tab[]) => Promise<chrome.tabs.Tab[]>
  
  
  const isVivaldiTab = (object: any): object is VivaldiTab => {
    return object && 'vivExtData' in object;
  };
  
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

/* Chrome Tabs promise wrappers */

export const chromeTabsMovePromise = (id: number, index: number): Promise<chrome.tabs.Tab[]> => (
  new Promise(function(resolve, reject) {
    console.log("moving tab to index : ", index);
    chrome.tabs.move(id, { index }, () => resolve());
  })
);

const chromeTabsUpdatePromise: UpdatePromise = (tabId: number, data: chrome.tabs.UpdateProperties | VivaldiUpdateProperties): Promise<any> => (
  new Promise(function(resolve, reject) {
    console.log("updating tab", tabId, data);
    chrome.tabs.update(tabId, data, (t) => resolve());
  })
);

const chromeTabsRemovePromise: RemovePromise = (tabId: number): Promise<any> => (
  new Promise(function(resolve, reject) {
    console.log("removing tab", tabId);
    chrome.tabs.remove(tabId,  () => { console.log("removed");resolve(); });
  })
);

const chromeTabsQueryPromise: QueryPromise = (query: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> => (
  new Promise(function(resolve, reject) {
    console.log("querying tabs ", query);
    chrome.tabs.query(query, resolve);
  })
);

/********************/

export const applyRulesForTab = (tab: chrome.tabs.Tab, config: RulesConfig) => {
  console.log("apply otto rules for tab", tab);  
  promiseSerial([
    () => removeDuplicates(tab, config, chromeTabsQueryPromise, chromeTabsRemovePromise),
    () => trimTabs(tab, config, chromeTabsQueryPromise, chromeTabsRemovePromise),
    () => moveSameUrlHost(
        tab,
        config,
        chromeTabsQueryPromise,
        regroupTabsPromise(chromeTabsMovePromise),
        moveVivaldi(chromeTabsUpdatePromise, uuidv4)
        ),
  ])
}

export const regroupTabsPromise = (chromeTabsMovePromise: (id: number, index: number)=> Promise<chrome.tabs.Tab[]>) : RegroupTabsPromise => (tabs: chrome.tabs.Tab[]) => {
  console.log("bla")
  if(tabs.length < 2) {
    console.log("no need to move", tabs.length, "tabs")
    return Promise.resolve(tabs)
  }

  console.log("move tabs...", tabs)
  const firstIndex = tabs[0].index;
  const movePromises = tabs
    .filter(t => t.id !== undefined)
    .map(((t, index) => () => chromeTabsMovePromise(t.id!, firstIndex + index)))
  return promiseSerial(movePromises)
    .then( () => Promise.resolve(tabs))
}


const moveVivaldi = (updatePromise: UpdatePromise, getUUID: () => string): GroupVivaldiTab => 
(tabs: VivaldiTab[]) => {
  return groupVivaldiTabsPromise(tabs, updatePromise, uuidv4)
}

const getQueryToGroup = (url: URL, config: RulesConfig) => {
  if(config.group.type === 'SUB_DOMAIN') {
    const hostname = url.hostname.startsWith("www.") ? url.hostname.substring(4) : url.hostname
    const domains = hostname.split(".")
    return "*://*." + (domains.length > 2 ? domains.slice(1) : domains).join(".") + "/*"
  } else {
    return "*://" + url.hostname + "/*"
  }
}

export const moveSameUrlHost = (
  tab: chrome.tabs.Tab | VivaldiTab,
  config: RulesConfig,
  queryPromise: QueryPromise,
  regroupTabsPromise: RegroupTabsPromise,
  groupVivaldiTabsPromise: GroupVivaldiTab) => (
  new Promise(function(resolve, reject) {
    if(!config.group.isActivated || !tab.url) {
      resolve();
      return;
    }

    console.log("Group tabs...")

    const hostQuery = getQueryToGroup(new URL(tab.url), config);
    queryPromise({url: hostQuery, currentWindow: true, pinned: false})
    .then(regroupTabsPromise)
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

export type GroupVivaldiTab = (tabs: VivaldiTab[]) => Promise<any>

export const groupVivaldiTabsPromise = (tabs: VivaldiTab[], updatePromise: UpdatePromise, getUUID: () => string ) => {
  console.log("group vivaldi tabs...")

  const tabsToExtData: { [k: number]: { group: string | null} } = tabs
    .filter(t => t.id !== undefined)
    .reduce( (old, curr) => {
        var data = {}
        try { data = JSON.parse(curr.vivExtData) } catch(e) {}

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
    groupIdToUse = existingGroupId ? existingGroupId : getUUID()
    console.log("group id to use", groupIdToUse)
  } else {
    console.log("only one tab, remove it's group id")
  }

  const updatePromises = Object.keys(tabsToExtData).map(t => parseInt(t)).map((tabId => {
    const newExtData = tabsToExtData[tabId]
    newExtData.group = groupIdToUse

    return () => updatePromise(tabId, { vivExtData : JSON.stringify(newExtData) } );
  }))
  return promiseSerial(updatePromises)
}

export const removeDuplicates = (
  tab: chrome.tabs.Tab,
  config: RulesConfig,
  queryPromise: QueryPromise,
  removePromise: RemovePromise) => (

  new Promise((resolve) => {
    if(!config.duplicates.isActivated) {
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

export const trimTabs = (tab: chrome.tabs.Tab,
  config: RulesConfig,
  queryPromise: QueryPromise,
  removePromise: RemovePromise) : Promise<any> => (
  new Promise( (resolve) => {
    
    if(!config.host.isActivated || !tab.url) {
      resolve();
      return;
    }

    console.log("Trimming tabs...")

    const url = new URL(tab.url);
    var hostQuery = url.origin + "/*";

    queryPromise({url: hostQuery, currentWindow: true, pinned: false})
    .then( tabs => {
      console.log(tabs.length, "tabs with same host")
      if(tabs.length > config.host.maxTabsAllowed) {
        const toRemove = tabs
          .filter(t => t.id !== undefined && t.id != tab.id)
          .slice(0, tabs.length - config.host.maxTabsAllowed + 1);

        console.log("trim tab ", toRemove)
        return promiseSerial(toRemove.map(t => () => removePromise(t.id!)))
      } else {
        return Promise.resolve()
      }
    })
    .then(resolve);
    
  })
);
