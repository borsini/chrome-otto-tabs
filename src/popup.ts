// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// A rule
// host (all, specific)
// behavior (group, remove dups, trim, pin, archive)



function $$(id) {
  return document.querySelector(id);
}

document.addEventListener('DOMContentLoaded', function () {
  
  var duplicates = $$("input[name=duplicates]")
  var group = $$("input[name=group]")
  var host = $$("input[name=host]")

  chrome.runtime.sendMessage('', 'GET_CONFIG', function(config) {
    duplicates.checked = config.duplicates
    group.checked = config.group
    host.checked = config.host
  })

  console.log(document)

  document.querySelectorAll('input').forEach(s => s.addEventListener('change', function() {
      chrome.runtime.sendMessage('', {
        duplicates: duplicates.checked,
        group: group.checked,
        host: host.checked
      })
  }));
});