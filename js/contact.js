/*
 * Assembles the email address at runtime so it never appears in the source.
 * Elements with data-mail get a mailto: link; data-mail-text also shows the address.
 */
(function () {
  'use strict';
  function rev(s) { return s.split('').reverse().join(''); }
  var user = [rev('relheukmiel'), rev('gnitlusnoc')].join('.');
  var host = [rev('liamg'), rev('moc')].join('.');
  var address = user + String.fromCharCode(64) + host;

  var els = document.querySelectorAll('[data-mail]');
  for (var i = 0; i < els.length; i++) {
    els[i].setAttribute('href', 'mailto:' + address);
    if (els[i].hasAttribute('data-mail-text')) els[i].textContent = address;
  }
})();
