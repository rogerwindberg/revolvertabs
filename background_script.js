var tabsManifest = {},
  settings = {},
  advSettings = {},
  windowStatus = {},
  moverTimeOut = {},
  listeners = {};

checkForAndMigrateOldSettings(function(){
  initSettings();
});

function initSettings(){
  badgeTabs("default");
  createBaseSettingsIfTheyDontExist();
  addEventListeners(function(){
    autoStartIfEnabled(chrome.windows.WINDOW_ID_CURRENT);
  });
}

function go(windowId) {
  chrome.tabs.query({"windowId": windowId, "active": true}, function(tab){
    grabTabSettings(windowId, tab[0], function(tabSetting){
      setMoverTimeout(windowId, tabSetting.seconds);
      windowStatus[windowId] = "on";
      badgeTabs('on', windowId);
    });
  });
}

function stop(windowId) {
  removeTimeout(windowId);
  windowStatus[windowId] = "off";
  badgeTabs('', windowId);
}

function activateTab(nextTab) {
  grabTabSettings(nextTab.windowId, nextTab, function(tabSetting){
    if (tabSetting.reload && !include(settings.noRefreshList, nextTab.url) && nextTab.url.substring(0,19) != "chrome://extensions") {
      chrome.tabs.reload(nextTab.id, function(){
        chrome.tabs.update(nextTab.id, {active: true}, function(){
          setMoverTimeout(tabSetting.windowId, tabSetting.seconds);
        });
      });
    } else {
      chrome.tabs.update(nextTab.id, {active: true});
      setMoverTimeout(tabSetting.windowId, tabSetting.seconds);
    }
  });
}

function moveTabIfIdle(timerWindowId, tabTimeout) {
  if (settings.inactive) {
    chrome.idle.queryState(15, function(state) {
      if (state == 'idle') {
        windowStatus[timerWindowId] = "on";
        badgeTabs("on", timerWindowId);
        moveTab(timerWindowId);
      } else {
        windowStatus[timerWindowId] = "pause";
        badgeTabs("pause", timerWindowId);
        setMoverTimeout(timerWindowId, tabTimeout);
      }
    });
  } else {
    moveTab(timerWindowId);
  }
}

function moveTab(timerWindowId) {
  chrome.tabs.query({"windowId": timerWindowId, "active": true}, function(tabs){
    const currentTab = tabs[0];
    chrome.tabs.query({"windowId": timerWindowId}, function(allTabs){
      let nextTabIndex = currentTab.index + 1 < allTabs.length ? currentTab.index + 1 : 0;
      activateTab(allTabs[nextTabIndex]);
    });
  });
}

function badgeTabs(text, windowId) {
  if (text === "default") {
    chrome.action.setBadgeText({text: "\u00D7"});
    chrome.action.setBadgeBackgroundColor({color: [255,0,0,100]});
  } else {
    chrome.tabs.query({"windowId": windowId, "active": true}, function(tabs){
      if (!tabs[0]) return;
      let tabId = tabs[0].id;
      if (text === "on") {
        chrome.action.setBadgeText({text: "\u2022", tabId});
        chrome.action.setBadgeBackgroundColor({color: [0,255,0,100], tabId});
      } else if (text === "pause") {
        chrome.action.setBadgeText({text: "\u2022", tabId});
        chrome.action.setBadgeBackgroundColor({color: [255,238,0,100], tabId});
      } else {
        chrome.action.setBadgeText({text: "\u00D7", tabId});
        chrome.action.setBadgeBackgroundColor({color: [255,0,0,100], tabId});
      }
    });
  }
}

function setMoverTimeout(timerWindowId, seconds){
  moverTimeOut[timerWindowId] = setTimeout(function(){
    removeTimeout(timerWindowId);
    moveTabIfIdle(timerWindowId, seconds);
  }, parseInt(seconds)*1000);
}

function removeTimeout(windowId){
  clearTimeout(moverTimeOut[windowId]);
  moverTimeOut[windowId] = "off";
}

function addEventListeners(callback){
  chrome.action.onClicked.addListener(function(tab){
    var windowId = tab.windowId;
    if (windowStatus[windowId] == "on" || windowStatus[windowId] == "pause") {
      stop(windowId);
    } else {
      createTabsManifest(windowId, function(){
        go(windowId);
      });
    }
  });

  chrome.windows.onRemoved.addListener(function(windowId){
    removeTimeout(windowId);
    delete moverTimeOut[windowId];
    delete windowStatus[windowId];
    delete tabsManifest[windowId];
  });

  chrome.tabs.onCreated.addListener(function(tab){
    createTabsManifest(tab.windowId, function(){
      setBadgeStatusOnActiveWindow(tab);
    });
  });

  chrome.tabs.onUpdated.addListener(function(tabId, changeObj, tab){
    setBadgeStatusOnActiveWindow(tab);
    if (changeObj.url) createTabsManifest(tab.windowId, function(){});
  });

  chrome.tabs.onActivated.addListener(function(activeInfo){
    checkIfWindowExists(activeInfo.windowId, function(exists){
      if (exists) setBadgeStatusOnActiveWindow({windowId: activeInfo.windowId});
    });
  });

  chrome.windows.onCreated.addListener(function(window){
    autoStartIfEnabled(window.id);
  });

  return callback();
}

function setBadgeStatusOnActiveWindow(tab){
  if (windowStatus[tab.windowId] === "on") badgeTabs("on", tab.windowId);
  else if (windowStatus[tab.windowId] === "pause") badgeTabs("pause", tab.windowId);
  else badgeTabs("", tab.windowId);
}

function createBaseSettingsIfTheyDontExist(){
  chrome.storage.local.get(["revolverSettings"], (result) => {
    if (!result.revolverSettings) {
      settings = {
        seconds: 15,
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

function autoStartIfEnabled(windowId){
  if (settings.autoStart) {
    createTabsManifest(windowId, function(){
      go(windowId);
    });
  }
}

function updateSettings(){
  chrome.storage.local.get(["revolverSettings", "revolverAdvSettings"], (result) => {
    settings = result.revolverSettings || {};
    advSettings = result.revolverAdvSettings || [];
  });
}

function include(arr, url) {
  return arr.indexOf(url) != -1;
}

function grabTabSettings(windowId, tab, callback) {
  for (let i = 0; i < tabsManifest[windowId].length; i++) {
    if (tabsManifest[windowId][i].url === tab.url) {
      return callback(tabsManifest[windowId][i]);
    }
  }
}

function createTabsManifest(windowId, callback) {
  chrome.tabs.query({"windowId": windowId}, function(tabs){
    assignSettingsToTabs(tabs, function(){
      tabsManifest[windowId] = tabs;
      callback();
    });
  });
}

function assignSettingsToTabs(tabs, callback){
  assignBaseSettings(tabs, function(){
    assignAdvancedSettings(tabs, function(){
      callback();
    });
  });
}

function assignBaseSettings(tabs, callback){
  for (let tab of tabs) {
    tab.reload = tab.reload || settings.reload;
    tab.seconds = tab.seconds || settings.seconds;
  }
  callback();
}

function assignAdvancedSettings(tabs, callback){
  for (let tab of tabs) {
    for (let adv of advSettings) {
      if (adv.url === tab.url) {
        tab.reload = adv.reload;
        tab.seconds = adv.seconds;
      }
    }
  }
  callback();
}

function checkForAndMigrateOldSettings(callback){
  chrome.storage.local.get("revolverSettings", (result) => {
    if (result.revolverSettings) callback();
    else callback();
  });
}

function getAllTabsInCurrentWindow(callback){
  chrome.tabs.query({windowId: chrome.windows.WINDOW_ID_CURRENT}, callback);
}

function checkIfWindowExists(windowId, callback){
  chrome.windows.getAll(function(windows){
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
