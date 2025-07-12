/* global chrome */

document.addEventListener('DOMContentLoaded', addEventListeners);

function addEventListeners() {
  restoreOptions();
  restoreAdvancedOptions();
  buildCurrentTabsList();
  document.querySelector('#save').addEventListener('click', saveAllOptions);
}

function saveBaseOptions(callback) {
  const appSettings = {
    seconds: document.getElementById("seconds").value,
    reload: document.getElementById("reload").checked,
    inactive: document.getElementById("inactive").checked,
    autostart: document.getElementById("autostart").checked,
    noRefreshList: document.getElementById('noRefreshList').value.split('\n')
  };

  chrome.storage.local.set({ "revolverSettings": appSettings }, () => {
    document.getElementById("status").textContent = "OPTIONS SAVED";
    setTimeout(() => { document.getElementById("status").textContent = ""; }, 1000);
    chrome.runtime.sendMessage({ action: "updateSettings" });
    callback();
  });
}

function restoreOptions() {
  chrome.storage.local.get("revolverSettings", (result) => {
    const appSettings = result.revolverSettings || {};
    document.getElementById("seconds").value = appSettings.seconds || 10;
    document.getElementById("reload").checked = appSettings.reload || false;
    document.getElementById("inactive").checked = appSettings.inactive || false;
    document.getElementById("autostart").checked = appSettings.autostart || false;
    document.getElementById("noRefreshList").value = (appSettings.noRefreshList || []).join('\n');
  });
}

function saveAdvancedOptions(callback) {
  const advUrlObjectArray = [];
  const advancedDivs = document.getElementById("adv-settings").getElementsByTagName("div");
  for (let i = 0; i < advancedDivs.length; i++) {
    if (advancedDivs[i].getElementsByClassName("enable")[0].checked) {
      const divInputTags = advancedDivs[i].getElementsByTagName("input");
      advUrlObjectArray.push({
        "url": advancedDivs[i].getElementsByClassName("url-text")[0].value,
        "reload": divInputTags[3].checked,
        "seconds": divInputTags[2].value,
        "favIconUrl": advancedDivs[i].getElementsByClassName("icon")[0].src
      });
    }
  }
  chrome.storage.local.set({ "revolverAdvSettings": advUrlObjectArray }, () => {
    chrome.runtime.sendMessage({ action: "updateSettings" });
    const status3 = document.getElementById("status3");
    if (status3) {
      status3.textContent = "OPTIONS SAVED";
      setTimeout(() => { status3.textContent = ""; }, 1000);
    }
    callback();
  });
}

function restoreAdvancedOptions() {
  chrome.storage.local.get("revolverAdvSettings", (result) => {
    const settings = result.revolverAdvSettings || [];
    if (settings.length > 0) {
      settings.forEach(tab => {
        generateAdvancedSettingsHtml(tab, true);
      });
    }
  });
}

function saveAllOptions() {
  saveBaseOptions(() => {
    saveAdvancedOptions(() => {});
  });
}

function generateAdvancedSettingsHtml(tab, saved) {
  const advancedSettings = document.getElementById("adv-settings");
  let enableHtmlChunk = '<div><input type="checkbox" class="enable" name="enable">';
  let iconAndUrlChunk = '<img class="icon" src="' + tab.favIconUrl + '"><input class="url-text" type="text" value="' + tab.url + '">';
  let secondsChunk = '<p><label for="seconds">Seconds:</label> <input type="text" name="seconds" value="10" style="width:30px;">';
  let reloadChunk = '<label class="inline" for="reload">Reload:</label> <input type="checkbox" name="reload"></p></div>';

  if (saved) {
    enableHtmlChunk = '<div><input type="checkbox" class="enable" name="enable" checked>';
    secondsChunk = '<p><label for="seconds">Seconds:</label> <input type="text" name="seconds" value="' + tab.seconds + '" style="width:30px;">';
    if (tab.reload) {
      reloadChunk = '<label class="inline" for="reload">Reload:</label> <input type="checkbox" name="reload" checked></p></div>';
    }
  }
  advancedSettings.innerHTML += enableHtmlChunk + iconAndUrlChunk + secondsChunk + reloadChunk;
}

function getCurrentTabs(callback) {
  const returnTabs = [];
  chrome.windows.getCurrent({ populate: true }, function(window) {
    window.tabs.forEach(function(tab) {
      if (!tab.url.startsWith("chrome-extension")) {
        returnTabs.push(tab);
      }
    });
    callback(returnTabs);
  });
}

function buildCurrentTabsList() {
  getCurrentTabs(function(allCurrentTabs) {
    chrome.storage.local.get("revolverAdvSettings", (result) => {
      const savedSettings = result.revolverAdvSettings || [];
      if (savedSettings.length > 0) {
        compareSavedAndCurrentUrls(function(urls) {
          for (let i = 0; i < urls.length; i++) {
            for (let y = 0; y < allCurrentTabs.length; y++) {
              if (urls[i] === allCurrentTabs[y].url) {
                generateAdvancedSettingsHtml(allCurrentTabs[y]);
              }
            }
          }
          createAdvancedSaveButton();
        });
      } else {
        allCurrentTabs.forEach(tab => {
          generateAdvancedSettingsHtml(tab);
        });
        createAdvancedSaveButton();
      }
    });
  });
}

function compareSavedAndCurrentUrls(callback) {
  let savedTabsUrls = [];
  let currentTabsUrls = [];
  let urlsToWrite = [];

  chrome.storage.local.get("revolverAdvSettings", (result) => {
    const savedSettings = result.revolverAdvSettings || [];
    savedSettings.forEach(save => {
      savedTabsUrls.push(save.url);
    });

    getCurrentTabs(function(allCurrentTabs) {
      allCurrentTabs.forEach(tab => {
        currentTabsUrls.push(tab.url);
      });

      currentTabsUrls.forEach(url => {
        if (savedTabsUrls.indexOf(url) === -1) {
          urlsToWrite.push(url);
        }
      });

      callback(urlsToWrite);
    });
  });
}

function createAdvancedSaveButton() {
  const parent = document.querySelector("#adv-settings");
  const advSaveButton = document.createElement("button");
  const advSaveIndicator = document.createElement("span");

  advSaveButton.setAttribute("id", "adv-save");
  advSaveButton.innerText = "Save";
  advSaveButton.addEventListener("click", saveAllOptions);
  advSaveIndicator.setAttribute("id", "status3");

  parent.appendChild(advSaveButton);
  parent.appendChild(advSaveIndicator);
}
