/**
 * The same mini cart, painted from session storage on arrival and refetched
 * only when the cart hash the server sent no longer matches what is cached.
 */
(function () {
  var CACHE_KEY = 'acme_cart_fragments';
  var HASH_KEY = 'acme_cart_hash';

  function read(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function write(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (error) {
      /* A private window refuses to store. Painting from the network is the
         fallback, and it is the behaviour this whole file exists to avoid
         needing, so it must not throw. */
    }
  }

  function paint(fragments) {
    Object.keys(fragments).forEach(function (selector) {
      var target = document.querySelector(selector);
      if (target) {
        target.innerHTML = fragments[selector];
      }
    });
  }

  function paintFromCache() {
    var cached = read(CACHE_KEY);
    if (!cached) {
      return false;
    }
    try {
      paint(JSON.parse(cached));
      return true;
    } catch (error) {
      return false;
    }
  }

  function fetchAndPaint() {
    return fetch(acme.ajaxUrl + '?wc-ajax=get_refreshed_fragments')
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        paint(data.fragments);
        write(CACHE_KEY, JSON.stringify(data.fragments));
        write(HASH_KEY, data.cart_hash || '');
      });
  }

  function syncIfStale() {
    if (read(HASH_KEY) === acme.cartHash && paintFromCache()) {
      return Promise.resolve();
    }
    return fetchAndPaint();
  }

  /* After load, not during it: the mini cart is not what the shopper is
     waiting for, and the server already rendered a correct count. */
  window.addEventListener('load', function () {
    syncIfStale();
  });

  /* The cart changing is the event worth listening to. Scroll and resize fire
     continuously and tell you nothing about the basket. */
  document.body.addEventListener('acme_cart_changed', function () {
    fetchAndPaint();
  });
})();
