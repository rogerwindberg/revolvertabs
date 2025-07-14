var tabsManifest = {},
  settings = {},
  advSettings = {},
  windowStatus = {};

checkForAndMigrateOldSettings(() => {
  initSettings();
});

function initSettings() {
  badgeTabs("default");
  createBaseSettingsIfTheyDontExist();
  addEventListeners(() => {
    autoStartIfEnabled(chrome.windows.WINDOW_ID_CURRENT);
  });
}

function go(windowId) {
  chrome.tabs.query({ "windowId": windowId, "active": true }, (tab) => {
    grabTabSettings(windowId, tab[0], (tabSetting) => {
      setMoverAlarm(windowId, tabSetting.seconds);
      windowStatus[windowId] = "on";
      badgeTabs("on", windowId);
    });
  });
}

function stop(windowId) {
  removeAlarm(windowId);
  windowStatus[windowId] = "off";
  badgeTabs("", windowId);
}

function moveTab(windowId) {
  chrome.tabs.query({ "windowId": windowId, "active": true }, (tabs) => {
    const currentTab = tabs[0];
    chrome.tabs.query({ "windowId": windowId }, (allTabs) => {
      const nextTabIndex = currentTab.index + 1 < allTabs.length ? currentTab.index + 1 : 0;
      const nextTab = allTabs[nextTabIndex];
      activateTab(nextTab, windowId);
    });
  });
}

function activateTab(nextTab, windowId) {
  grabTabSettings(windowId, nextTab, (tabSetting) => {
    setMoverAlarm(windowId, tabSetting.seconds);

    chrome.tabs.update(nextTab.id, { active: true });

    if (tabSetting.reload && !include(settings.noRefreshList, nextTab.url)) {
      chrome.tabs.reload(nextTab.id);
    }
  });
}

function setMoverAlarm(windowId, seconds) {
  const alarmName = `rotate-${windowId}`;
  chrome.alarms.clear(alarmName, () => {
    chrome.alarms.create(alarmName, {
      delayInMinutes: parseInt(seconds) / 60
    });
  });
}

function removeAlarm(windowId) {
  chrome.alarms.clear(`rotate-${windowId}`);
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name.startsWith('rotate-')) {
    const windowId = parseInt(alarm.name.split('-')[1]);
    moveTab(windowId);
  }
});

function badgeTabs(text, windowId) {
  if (text === "default") {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: [255, 0, 0, 100] });
  } else {
    chrome.tabs.query({ "windowId": windowId, "active": true }, (tabs) => {
      if (!tabs[0]) return;
      const tabId = tabs[0].id;
      if (text === "on") {
        chrome.action.setBadgeText({ text: "ON", tabId });
        chrome.action.setBadgeBackgroundColor({ color: [0, 255, 0, 100], tabId });
      } else {
        chrome.action.setBadgeText({ text: "OFF", tabId });
        chrome.action.setBadgeBackgroundColor({ color: [255, 0, 0, 100], tabId });
      }
    });
  }
}

function createBaseSettingsIfTheyDontExist() {
  chrome.storage.local.get(["revolverSettings"], (result) => {
    if (!result.revolverSettings) {
      settings = {
        seconds: 5,
        reload: false,
        inactive: false,
        autoStart: false,
        noRefreshList: []
      };
      chrome.storage.local.set({ "revolverSettings": settings });
    } else {
      settings = result.revolverSettings;
    }
  });

  chrome.storage.local.get(["revolverAdvSettings"], (result) => {
    advSettings = result.revolverAdvSettings || [];
  });

  return true;
}

function autoStartIfEnabled(windowId) {
  if (settings.autoStart) {
    createTabsManifest(windowId, () => {
      go(windowId);
    });
  }
}

function grabTabSettings(windowId, tab, callback) {
  if (!tab) {
    chrome.tabs.query({ windowId: windowId, active: true }, (tabs) => {
      tab = tabs[0];
      _grab(windowId, tab, callback);
    });
  } else {
    _grab(windowId, tab, callback);
  }

  function _grab(windowId, tab, callback) {
    for (let i = 0; i < tabsManifest[windowId].length; i++) {
      if (tabsManifest[windowId][i].url === tab.url) {
        return callback(tabsManifest[windowId][i]);
      }
    }
    callback(settings);
  }
}

function createTabsManifest(windowId, callback) {
  chrome.tabs.query({ "windowId": windowId }, (tabs) => {
    assignSettingsToTabs(tabs, () => {
      tabsManifest[windowId] = tabs;
      callback();
    });
  });
}

function assignSettingsToTabs(tabs, callback) {
  assignBaseSettings(tabs, () => {
    assignAdvancedSettings(tabs, () => {
      callback();
    });
  });
}

function assignBaseSettings(tabs, callback) {
  for (let tab of tabs) {
    tab.reload = tab.reload || settings.reload;
    tab.seconds = tab.seconds || settings.seconds;
  }
  callback();
}

function assignAdvancedSettings(tabs, callback) {
  for (let tab of tabs) {
    for (let adv of advSettings) {
      if (adv.url === tab.url && adv.enabled) {
        tab.reload = adv.reload;
        tab.seconds = adv.seconds;
      }
    }
  }
  callback();
}

function include(arr, url) {
  return arr.indexOf(url) !== -1;
}

function checkForAndMigrateOldSettings(callback) {
  chrome.storage.local.get("revolverSettings", (result) => {
    callback();
  });
}

function addEventListeners(callback) {
  chrome.action.onClicked.addListener(tab => {
    const windowId = tab.windowId;
    if (windowStatus[windowId] === "on") {
      stop(windowId);
    } else {
      createTabsManifest(windowId, () => {
        go(windowId);
      });
    }
  });

  chrome.windows.onRemoved.addListener(windowId => {
    removeAlarm(windowId);
    delete windowStatus[windowId];
    delete tabsManifest[windowId];
  });

  chrome.tabs.onCreated.addListener(tab => {
    createTabsManifest(tab.windowId, () => {
      setBadgeStatusOnActiveWindow(tab);
    });
  });

  chrome.tabs.onUpdated.addListener((tabId, changeObj, tab) => {
    setBadgeStatusOnActiveWindow(tab);
    if (changeObj.url) {
      createTabsManifest(tab.windowId, () => { });
    }
  });

  chrome.tabs.onActivated.addListener(activeInfo => {
    checkIfWindowExists(activeInfo.windowId, (exists) => {
      if (exists) setBadgeStatusOnActiveWindow({ windowId: activeInfo.windowId });
    });
  });

  chrome.windows.onCreated.addListener(window => {
    autoStartIfEnabled(window.id);
  });

  return callback();
}

function setBadgeStatusOnActiveWindow(tab) {
  if (windowStatus[tab.windowId] === "on") badgeTabs("on", tab.windowId);
  else badgeTabs("", tab.windowId);
}

function checkIfWindowExists(windowId, callback) {
  chrome.windows.getAll((windows) => {
    for (let win of windows) {
      if (win.id === windowId) return callback(true);
    }
    callback(false);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateSettings") {
    updateSettings();
    sendResponse({ status: "OK" });
  }
});

function updateSettings() {
  chrome.storage.local.get(["revolverSettings", "revolverAdvSettings"], (result) => {
    settings = result.revolverSettings || {};
    advSettings = result.revolverAdvSettings || [];
  });
}