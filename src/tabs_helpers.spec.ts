import * as spies from 'chai-spies';
import * as chai from 'chai';

import { describe, beforeEach, it } from 'mocha';

import {
  QueryPromise,
  RulesConfig,
  RemovePromise,
  trimTabs,
  removeDuplicates,
  moveSameUrlHost,
  MoveTabsPromise,
  GroupVivaldiTab
} from './tabs_helpers'
import { expect } from 'chai';

beforeEach(() => {
  chai.use(spies)
})

describe('trimTabs()', function () {
  it('doesnt do anything if config disabled', () => {
    const tab: chrome.tabs.Tab = {
      index: 1,
      url: "http://url",
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      id: 123,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: false
    }

    const conf: RulesConfig = {
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

    const queryPromise: QueryPromise = (i: chrome.tabs.QueryInfo) => {
      return Promise.resolve([])
    }

    const removePromise: RemovePromise = (id: number) => {
      return Promise.resolve()
    }

    const removeSpy = chai.spy(removePromise)

    return trimTabs(tab, conf, queryPromise, removeSpy).then(() => {
      expect(removeSpy).not.to.have.been.called()
    })

  })

  it('doesnt do anything with only one tab', () => {
    const tab: chrome.tabs.Tab = {
      index: 1,
      url: "http://url",
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      id: 123,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: false
    }

    const conf: RulesConfig = {
      duplicates: {
        isActivated: true,
      },
      group: {
        isActivated: true,
        type: "FULL_DOMAIN"
      },
      host: {
        isActivated: true,
        maxTabsAllowed: 5,
      }
    }

    const queryPromise: QueryPromise = (i: chrome.tabs.QueryInfo) => {
      return Promise.resolve([])
    }

    const removePromise: RemovePromise = (id: number) => {
      return Promise.resolve()
    }

    const removeSpy = chai.spy(removePromise)

    return trimTabs(tab, conf, queryPromise, removeSpy).then(() => {
      expect(removeSpy).not.to.have.been.called()
    })

  })

  it('doesnt do anything with less than allowed tabs', () => {
    const tab: chrome.tabs.Tab = {
      index: 1,
      url: "http://url",
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      id: 123,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: false
    }

    const conf: RulesConfig = {
      duplicates: {
        isActivated: true,
      },
      group: {
        isActivated: true,
        type: "FULL_DOMAIN"
      },
      host: {
        isActivated: true,
        maxTabsAllowed: 5,
      }
    }

    const queryPromise: QueryPromise = (i: chrome.tabs.QueryInfo) => {
      return Promise.resolve([tab])
    }

    const removePromise: RemovePromise = (id: number) => {
      return Promise.resolve()
    }


    const removeSpy = chai.spy(removePromise)

    return trimTabs(tab, conf, queryPromise, removeSpy).then(() => {
      expect(removeSpy).not.to.have.been.called()
    })
  })

  it('trims the oldest tabs', () => {
    const tab: chrome.tabs.Tab = {
      index: 1,
      url: "http://url",
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      id: 1,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: false
    }

    const conf: RulesConfig = {
      duplicates: {
        isActivated: true,
      },
      group: {
        isActivated: true,
        type: "FULL_DOMAIN"
      },
      host: {
        isActivated: true,
        maxTabsAllowed: 1,
      }
    }

    const t2 = { ...tab, id: 2 }

    const queryPromise: QueryPromise = (i: chrome.tabs.QueryInfo) => {
      return Promise.resolve([t2])
    }

    const removePromise: RemovePromise = (id: number) => {
      return Promise.resolve()
    }

    const removeSpy = chai.spy(removePromise)

    return trimTabs(tab, conf, queryPromise, removeSpy).then(() => {
      expect(removeSpy).to.have.been.called.always.with.exactly(2)
    })
  })

  it('trims the oldest tab', () => {
    const tab: chrome.tabs.Tab = {
      index: 1,
      url: "http://url",
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      id: 1,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: false
    }

    const conf: RulesConfig = {
      duplicates: {
        isActivated: true,
      },
      group: {
        isActivated: true,
        type: "FULL_DOMAIN"
      },
      host: {
        isActivated: true,
        maxTabsAllowed: 2,
      }
    }

    const t2 = { ...tab, id: 2 }
    const t3 = { ...tab, id: 3 }
    const t4 = { ...tab, id: 4 }

    const queryPromise: QueryPromise = (i: chrome.tabs.QueryInfo) => {
      return Promise.resolve([t2, t3, t4])
    }

    const removePromise: RemovePromise = (id: number) => {
      return Promise.resolve()
    }

    const removeSpy = chai.spy(removePromise)

    return trimTabs(tab, conf, queryPromise, removeSpy).then(() => {
      expect(removeSpy).to.have.been.called.with(2)
      expect(removeSpy).to.have.been.called.with(3)
    })
  })
})


describe('removeDuplicates()', function () {
  it('doesnt do anything if config disabled', () => {
    const tab: chrome.tabs.Tab = {
      index: 1,
      url: "http://url",
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      id: 123,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: false
    }

    const conf: RulesConfig = {
      duplicates: {
        isActivated: false,
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

    const queryPromise: QueryPromise = (i: chrome.tabs.QueryInfo) => {
      return Promise.resolve([])
    }

    const removePromise: RemovePromise = (id: number) => {
      return Promise.resolve()
    }

    const removeSpy = chai.spy(removePromise)

    return removeDuplicates(tab, conf, queryPromise, removeSpy).then(() => {
      expect(removeSpy).not.to.have.been.called()
    })

  })

  it('doesnt do anything if tabs have different urls', () => {
    const tab: chrome.tabs.Tab = {
      index: 1,
      url: "http://url",
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      id: 123,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: false
    }

    const conf: RulesConfig = {
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

    const tab2 = { ...tab, id: 321, url: "http://lru"}

    const queryPromise: QueryPromise = (i: chrome.tabs.QueryInfo) => {
      return Promise.resolve([tab, tab2])
    }

    const removePromise: RemovePromise = (id: number) => {
      return Promise.resolve()
    }

    const removeSpy = chai.spy(removePromise)

    return removeDuplicates(tab, conf, queryPromise, removeSpy).then(() => {
      expect(removeSpy).not.to.have.been.called()
    })

  })

  it('removes first tabs if tabs have same urls', () => {
    const tab: chrome.tabs.Tab = {
      index: 1,
      url: "http://url",
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      id: 4,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: false
    }

    const conf: RulesConfig = {
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

    const tab2 = { ...tab, id: 1, url: "http://url"}
    const tab3 = { ...tab, id: 2, url: "http://lru"}
    const tab4 = { ...tab, id: 3, url: "http://url"}


    const queryPromise: QueryPromise = (i: chrome.tabs.QueryInfo) => {
      return Promise.resolve([tab, tab2, tab3, tab4])
    }

    const removePromise: RemovePromise = (id: number) => {
      return Promise.resolve()
    }

    const removeSpy = chai.spy(removePromise)

    return removeDuplicates(tab, conf, queryPromise, removeSpy).then(() => {
      expect(removeSpy).to.have.been.called.with(1)
      expect(removeSpy).to.have.been.called.with(3)
    })

  })
})

describe('moveSameUrlHost()', function () {
  it('doesnt do anything if config disabled', () => {
    const tab: chrome.tabs.Tab = {
      index: 1,
      url: "http://url",
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      id: 123,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: false
    }

    const conf: RulesConfig = {
      duplicates: {
        isActivated: false,
      },
      group: {
        isActivated: false,
        type: "FULL_DOMAIN"
      },
      host: {
        isActivated: false,
        maxTabsAllowed: 5,
      }
    }

    const queryPromise: QueryPromise = (i: chrome.tabs.QueryInfo) => {
      return Promise.resolve([])
    }

    const moveTabPromise: MoveTabsPromise = (tabs: chrome.tabs.Tab[]) => {
      return Promise.resolve([])
    }

    const moveSpy = chai.spy(moveTabPromise)

    const groupVivaldiTabs: GroupVivaldiTab = (tabs: chrome.tabs.Tab[]) => {
      return Promise.resolve([])
    }

    const vivaldiSpy = chai.spy(groupVivaldiTabs)

    return moveSameUrlHost(tab, conf, queryPromise, moveSpy, vivaldiSpy).then(() => {
      expect(moveSpy).not.to.have.been.called()
      expect(vivaldiSpy).not.to.have.been.called()
    })

  })
})