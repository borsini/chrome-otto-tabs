
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

  export type ChromeTab = chrome.tabs.Tab
  
 
export type RemovePromise = (tabId: number) => Promise<any>
export type UpdatePromise = (tabId: number, data: chrome.tabs.UpdateProperties) => Promise<any>
export type GroupPromise = (options: chrome.tabs.GroupOptions) => Promise<any>
export type QueryPromise = (url?: string) => Promise<ChromeTab[]>
export type RegroupTabsPromise = (tabs: ChromeTab[]) => Promise<ChromeTab[]>
  
const promiseSerial = (funcs : Array<() => Promise<any>>) =>
  funcs.reduce((promise, func) =>
  promise.then(result => func().then(Array.prototype.concat.bind(result))),
  Promise.resolve([]))

/* Chrome Tabs promise wrappers */

export const chromeTabsMovePromise = (id: number, index: number): Promise<ChromeTab[]> => (
  new Promise(function(resolve, reject) {
    console.log("moving tab to index : ", index);
    chrome.tabs.move(id, { index }, () => resolve([]));
  })
);

const chromeTabsUpdatePromise: UpdatePromise = (tabId: number, data: chrome.tabs.UpdateProperties): Promise<any> => (
  new Promise(function(resolve, reject) {
    console.log("updating tab", tabId, data);
    chrome.tabs.update(tabId, data, (t) => resolve([]));
  })
);

const chromeTabsGroupPromise: GroupPromise = (options: chrome.tabs.GroupOptions): Promise<any> => (
  new Promise(function(resolve, reject) {
    console.log("grouping tabs", options);
    chrome.tabs.group(options,  (t) => resolve([]));
  })
);

const chromeTabsRemovePromise: RemovePromise = (tabId: number): Promise<any> => (
  new Promise(function(resolve, reject) {
    console.log("removing tab", tabId);
    chrome.tabs.remove(tabId,  () => { console.log("removed");resolve([]); });
  })
);

/********************/

export const applyRulesForTab = (tab: ChromeTab, config: RulesConfig) => {
  console.log("apply otto rules for tab", tab)
  
  const chromeTabsQueryPromise: QueryPromise = (url?: string): Promise<ChromeTab[]> => (
    new Promise(function(resolve, reject) {
      const query = {
        url,
        currentWindow: true,
        pinned: false,
      }
      console.log("querying tabs ", query);
      chrome.tabs.query(query, resolve);
    })
  );

  promiseSerial([
    () => removeDuplicates(tab, config, chromeTabsQueryPromise, chromeTabsRemovePromise),
    () => trimTabs(tab, config, chromeTabsQueryPromise, chromeTabsRemovePromise),
    () => moveSameUrlHost(
        tab,
        config,
        chromeTabsQueryPromise,
        regroupTabsPromise(chromeTabsMovePromise),
        groupChrome(),
        ),
  ]).catch(err => console.log(err))
}

export const regroupTabsPromise = (chromeTabsMovePromise: (id: number, index: number)=> Promise<ChromeTab[]>) : RegroupTabsPromise => (tabs: ChromeTab[]) => {
  
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

const groupChrome = (): GroupChromeTab =>
(tabs: ChromeTab[]) => {
  return groupChromeTabsPromise(tabs)
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
  tab: ChromeTab,
  config: RulesConfig,
  queryPromise: QueryPromise,
  regroupTabsPromise: RegroupTabsPromise,
  groupChromeTabsPromise: GroupChromeTab,
) => (
  new Promise(function(resolve, reject) {
    if(!config.group.isActivated || !tab.url) {
      resolve([]);
      return;
    }

    console.log("Group tabs...")

    const hostQuery = getQueryToGroup(new URL(tab.url), config);
    queryPromise(hostQuery)
    .then(regroupTabsPromise)
    .then( tabs => groupChromeTabsPromise(tabs))
    .then( () => resolve([]))
  })
);

export type GroupChromeTab = (tabs: ChromeTab[]) => Promise<any>

export const groupChromeTabsPromise = (tabs: ChromeTab[]) => {
  console.log("group chrome tabs...")

  if(tabs.length == 1) return Promise.resolve()

  const groupIdToUse : number | undefined =  tabs
    .map(d => d.groupId)
    .find(g => g !== undefined && g != -1)

  console.log("group id to use", groupIdToUse)

  const tabIds = tabs
  .map( t => t.id )
  .filter((id): id is number => !!id)


  console.log("tabIds: ", tabIds)

  return chromeTabsGroupPromise({
    tabIds: tabIds,
    groupId: groupIdToUse,
  })
}

export const removeDuplicates = (
  tab: ChromeTab,
  config: RulesConfig,
  queryPromise: QueryPromise,
  removePromise: RemovePromise) => (

  new Promise((resolve) => {
    if(!config.duplicates.isActivated) {
      resolve([]);
      return;
    }

    console.log("Removing duplicates...")

    queryPromise()
    .then(allTabs => {
      const tabs = allTabs.filter( t => t.id !== undefined && t.url == tab.url && t.id != tab.id)
      console.log(tabs.length, "identical tabs to tab id ", tab.id, " : ", tabs)
      if(tabs.length > 0) {
        console.log("remove tabs ", tabs)
        return promiseSerial(tabs.map(t => () => removePromise(t.id!)))
      } else {
        return Promise.resolve([])
      }
    })
    .then(resolve);
  })
);

export const trimTabs = (tab: ChromeTab,
  config: RulesConfig,
  queryPromise: QueryPromise,
  removePromise: RemovePromise) : Promise<any> => (
  new Promise( (resolve) => {
    
    if(!config.host.isActivated || !tab.url) {
      resolve([]);
      return;
    }

    console.log("Trimming tabs...")

    const url = new URL(tab.url);
    var hostUrl = url.origin + "/*";
    
    queryPromise(hostUrl)
    .then( tabs => {
      console.log(tabs.length, "tabs with same host")
      if(tabs.length > config.host.maxTabsAllowed) {
        const toRemove = tabs
          .filter(t => t.id !== undefined && t.id != tab.id)
          .slice(0, tabs.length - config.host.maxTabsAllowed + 1);

        console.log("trim tab ", toRemove)
        return promiseSerial(toRemove.map(t => () => removePromise(t.id!)))
      } else {
        return Promise.resolve([])
      }
    })
    .then(resolve);
    
  })
);
