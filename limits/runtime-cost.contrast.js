/**
 * The same refresh in the wrong place, which is the part that can be read off
 * the source.
 */
(function () {
  function refreshFragments() {
    return fetch(acme.ajaxUrl + '?wc-ajax=get_refreshed_fragments').then(function (response) {
      return response.json();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    refreshFragments();
  });
})();
