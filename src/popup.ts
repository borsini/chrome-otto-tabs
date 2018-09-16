// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// A rule
// host (all, specific)
// behavior (group, remove dups, trim, pin, archive)



function $$(id: string) {
  return document.querySelector(id);
}

document.addEventListener('DOMContentLoaded', function () {
  
  var duplicates = $$("input[name=duplicates]") as HTMLInputElement
  var group = $$("input[name=group]") as HTMLInputElement
  var host = $$("input[name=host]") as HTMLInputElement

  chrome.runtime.sendMessage('', 'GET_CONFIG', function(config: RulesConfig) {
    duplicates.checked = config.duplicates.isActivated
    group.checked = config.group.isActivated
    host.checked = config.host.isActivated
  })

  console.log(document)

  document.querySelectorAll('input').forEach(s => s.addEventListener('change', function() {
      const conf: RulesConfig =  {
        duplicates: {
          isActivated: duplicates.checked,
        },
        group: {
          isActivated: group.checked,
        },
        host: {
          isActivated: host.checked,
        }
      }
      chrome.runtime.sendMessage('', conf)
  }));
});