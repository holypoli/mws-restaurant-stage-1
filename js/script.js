"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _readOnlyError(name) { throw new Error("\"" + name + "\" is read-only"); }

(function () {
  function toArray(arr) {
    return Array.prototype.slice.call(arr);
  }

  function promisifyRequest(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function promisifyRequestCall(obj, method, args) {
    var request;
    var p = new Promise(function (resolve, reject) {
      request = obj[method].apply(obj, args);
      promisifyRequest(request).then(resolve, reject);
    });
    p.request = request;
    return p;
  }

  function promisifyCursorRequestCall(obj, method, args) {
    var p = promisifyRequestCall(obj, method, args);
    return p.then(function (value) {
      if (!value) return;
      return new Cursor(value, p.request);
    });
  }

  function proxyProperties(ProxyClass, targetProp, properties) {
    properties.forEach(function (prop) {
      Object.defineProperty(ProxyClass.prototype, prop, {
        get: function get() {
          return this[targetProp][prop];
        },
        set: function set(val) {
          this[targetProp][prop] = val;
        }
      });
    });
  }

  function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;

      ProxyClass.prototype[prop] = function () {
        return promisifyRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;

      ProxyClass.prototype[prop] = function () {
        return this[targetProp][prop].apply(this[targetProp], arguments);
      };
    });
  }

  function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;

      ProxyClass.prototype[prop] = function () {
        return promisifyCursorRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function Index(index) {
    this._index = index;
  }

  proxyProperties(Index, "_index", ["name", "keyPath", "multiEntry", "unique"]);
  proxyRequestMethods(Index, "_index", IDBIndex, ["get", "getKey", "getAll", "getAllKeys", "count"]);
  proxyCursorRequestMethods(Index, "_index", IDBIndex, ["openCursor", "openKeyCursor"]);

  function Cursor(cursor, request) {
    this._cursor = cursor;
    this._request = request;
  }

  proxyProperties(Cursor, "_cursor", ["direction", "key", "primaryKey", "value"]);
  proxyRequestMethods(Cursor, "_cursor", IDBCursor, ["update", "delete"]); // proxy 'next' methods

  ["advance", "continue", "continuePrimaryKey"].forEach(function (methodName) {
    if (!(methodName in IDBCursor.prototype)) return;

    Cursor.prototype[methodName] = function () {
      var cursor = this;
      var args = arguments;
      return Promise.resolve().then(function () {
        cursor._cursor[methodName].apply(cursor._cursor, args);

        return promisifyRequest(cursor._request).then(function (value) {
          if (!value) return;
          return new Cursor(value, cursor._request);
        });
      });
    };
  });

  function ObjectStore(store) {
    this._store = store;
  }

  ObjectStore.prototype.createIndex = function () {
    return new Index(this._store.createIndex.apply(this._store, arguments));
  };

  ObjectStore.prototype.index = function () {
    return new Index(this._store.index.apply(this._store, arguments));
  };

  proxyProperties(ObjectStore, "_store", ["name", "keyPath", "indexNames", "autoIncrement"]);
  proxyRequestMethods(ObjectStore, "_store", IDBObjectStore, ["put", "add", "delete", "clear", "get", "getAll", "getKey", "getAllKeys", "count"]);
  proxyCursorRequestMethods(ObjectStore, "_store", IDBObjectStore, ["openCursor", "openKeyCursor"]);
  proxyMethods(ObjectStore, "_store", IDBObjectStore, ["deleteIndex"]);

  function Transaction(idbTransaction) {
    this._tx = idbTransaction;
    this.complete = new Promise(function (resolve, reject) {
      idbTransaction.oncomplete = function () {
        resolve();
      };

      idbTransaction.onerror = function () {
        reject(idbTransaction.error);
      };

      idbTransaction.onabort = function () {
        reject(idbTransaction.error);
      };
    });
  }

  Transaction.prototype.objectStore = function () {
    return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
  };

  proxyProperties(Transaction, "_tx", ["objectStoreNames", "mode"]);
  proxyMethods(Transaction, "_tx", IDBTransaction, ["abort"]);

  function UpgradeDB(db, oldVersion, transaction) {
    this._db = db;
    this.oldVersion = oldVersion;
    this.transaction = new Transaction(transaction);
  }

  UpgradeDB.prototype.createObjectStore = function () {
    return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
  };

  proxyProperties(UpgradeDB, "_db", ["name", "version", "objectStoreNames"]);
  proxyMethods(UpgradeDB, "_db", IDBDatabase, ["deleteObjectStore", "close"]);

  function DB(db) {
    this._db = db;
  }

  DB.prototype.transaction = function () {
    return new Transaction(this._db.transaction.apply(this._db, arguments));
  };

  proxyProperties(DB, "_db", ["name", "version", "objectStoreNames"]);
  proxyMethods(DB, "_db", IDBDatabase, ["close"]); // Add cursor iterators
  // TODO: remove this once browsers do the right thing with promises

  ["openCursor", "openKeyCursor"].forEach(function (funcName) {
    [ObjectStore, Index].forEach(function (Constructor) {
      // Don't create iterateKeyCursor if openKeyCursor doesn't exist.
      if (!(funcName in Constructor.prototype)) return;

      Constructor.prototype[funcName.replace("open", "iterate")] = function () {
        var args = toArray(arguments);
        var callback = args[args.length - 1];
        var nativeObject = this._store || this._index;
        var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));

        request.onsuccess = function () {
          callback(request.result);
        };
      };
    });
  }); // polyfill getAll

  [Index, ObjectStore].forEach(function (Constructor) {
    if (Constructor.prototype.getAll) return;

    Constructor.prototype.getAll = function (query, count) {
      var instance = this;
      var items = [];
      return new Promise(function (resolve) {
        instance.iterateCursor(query, function (cursor) {
          if (!cursor) {
            resolve(items);
            return;
          }

          items.push(cursor.value);

          if (count !== undefined && items.length == count) {
            resolve(items);
            return;
          }

          cursor.continue();
        });
      });
    };
  });
  var exp = {
    open: function open(name, version, upgradeCallback) {
      var p = promisifyRequestCall(indexedDB, "open", [name, version]);
      var request = p.request;

      if (request) {
        request.onupgradeneeded = function (event) {
          if (upgradeCallback) {
            upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
          }
        };
      }

      return p.then(function (db) {
        return new DB(db);
      });
    },
    delete: function _delete(name) {
      return promisifyRequestCall(indexedDB, "deleteDatabase", [name]);
    }
  };

  if (typeof module !== "undefined") {
    module.exports = exp;
    module.exports.default = module.exports;
  } else {
    self.idb = exp;
  }
})();
/**
 * Common database helper functions.
 */


var DBHelper =
/*#__PURE__*/
function () {
  function DBHelper() {
    _classCallCheck(this, DBHelper);
  }

  _createClass(DBHelper, null, [{
    key: "openDb",

    /**
     * Create new IndexDB
     */
    value: function openDb() {
      var dbPromise = idb.open("restaurant-db", 2, function (upgradeDb) {
        switch (upgradeDb.oldVersion) {
          case 0:
            var restaurantStore = upgradeDb.createObjectStore("restaurants", {
              keyPath: "id"
            });

          case 1:
            var reviewStore = upgradeDb.createObjectStore("reviews", {
              autoIncrement: true,
              keyPath: "id"
            });
        }
      });
      return dbPromise;
    }
    /**
     * Fetch all restaurants.
     */

  }, {
    key: "fetchRestaurants",
    value: function fetchRestaurants() {
      var _this = this;

      fetch(this.DATABASE_URL).then(function (response) {
        return response.json();
      }).then(function (data) {
        _this.addRestaurants(data);
      }).catch(function (err) {
        console.log(err);
      });
    }
  }, {
    key: "fetchRestaurantsOffline",
    value: function fetchRestaurantsOffline() {
      var _this2 = this;

      return this.openDb().then(function (db) {
        var tx = db.transaction("restaurants", "readwrite");
        var store = tx.objectStore("restaurants");
        return store.getAll();
      }).then(function (restaurants) {
        if (!restaurants || restaurants.length === 0) {
          _this2.fetchRestaurants().then(function (restaurants) {
            return restaurants;
          });
        } else return restaurants;
      });
    }
  }, {
    key: "addRestaurants",
    value: function addRestaurants(restaurants) {
      return this.openDb().then(function (db) {
        var tx = db.transaction("restaurants", "readwrite");
        var store = tx.objectStore("restaurants");
        return Promise.all(restaurants.map(function (restaurant) {
          return store.put(restaurant);
        })).catch(function (err) {
          tx.abort();
          console.log(err);
        });
      }).catch(function (err) {
        return console.log(err);
      });
    }
  }, {
    key: "fetchRestaurantByIdOffline",
    value: function fetchRestaurantByIdOffline(id) {
      var _this3 = this;

      return this.openDb().then(function (db) {
        var tx = db.transaction("restaurants", "readonly");
        var store = tx.objectStore("restaurants");
        return store.get(parseInt(id));
      }).then(function (restaurant) {
        console.log(restaurant);
        if (!restaurant) return _this3.fetchRestaurantById(id);
        return restaurant;
      });
    }
    /**
     * Fetch a restaurant by its ID.
     */

  }, {
    key: "fetchRestaurantById",
    value: function fetchRestaurantById(id) {
      // fetch all restaurants with proper error handling.
      fetch(this.DATABASE_URL + "/".concat(id)).then(function (response) {
        return response.json();
      }).catch(function (err) {
        console.log(err);
      });
    }
    /**
     * Fetch restaurants by a cuisine type with proper error handling.
     */

  }, {
    key: "fetchRestaurantByCuisine",
    value: function fetchRestaurantByCuisine(cuisine, callback) {
      // Fetch all restaurants  with proper error handling
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          console.log(error);
        } else {
          // Filter restaurants to have only given cuisine type
          var results = restaurants.filter(function (r) {
            return r.cuisine_type == cuisine;
          });
        }
      });
    }
    /**
     * Fetch restaurants by a neighborhood with proper error handling.
     */

  }, {
    key: "fetchRestaurantByNeighborhood",
    value: function fetchRestaurantByNeighborhood(neighborhood, callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Filter restaurants to have only given neighborhood
          var results = restaurants.filter(function (r) {
            return r.neighborhood == neighborhood;
          });
          callback(null, results);
        }
      });
    }
    /**
     * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
     */

  }, {
    key: "fetchRestaurantByCuisineAndNeighborhood",
    value: function fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          var results = restaurants;

          if (cuisine != "all") {
            // filter by cuisine
            results = results.filter(function (r) {
              return r.cuisine_type == cuisine;
            });
          }

          if (neighborhood != "all") {
            // filter by neighborhood
            results = results.filter(function (r) {
              return r.neighborhood == neighborhood;
            });
          }

          callback(null, results);
        }
      });
    }
    /**
     * Fetch all neighborhoods with proper error handling.
     */

  }, {
    key: "fetchNeighborhoods",
    value: function fetchNeighborhoods(callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Get all neighborhoods from all restaurants
          var _neighborhoods = restaurants.map(function (v, i) {
            return restaurants[i].neighborhood;
          }); // Remove duplicates from neighborhoods


          var uniqueNeighborhoods = _neighborhoods.filter(function (v, i) {
            return _neighborhoods.indexOf(v) == i;
          });

          callback(null, uniqueNeighborhoods);
        }
      });
    }
    /**
     * Fetch all cuisines with proper error handling.
     */

  }, {
    key: "fetchCuisines",
    value: function fetchCuisines(callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Get all cuisines from all restaurants
          var _cuisines = restaurants.map(function (v, i) {
            return restaurants[i].cuisine_type;
          }); // Remove duplicates from cuisines


          var uniqueCuisines = _cuisines.filter(function (v, i) {
            return _cuisines.indexOf(v) == i;
          });

          callback(null, uniqueCuisines);
        }
      });
    }
    /**
     * Favor and unfavor restaurants
     */

  }, {
    key: "favorRestaurant",
    value: function favorRestaurant(id) {
      var _this4 = this;

      console.log(id);
      fetch("".concat(DBHelper.DATABASE_URL, "/").concat(id, "/?is_favorite=true"), {
        method: "PUT"
      }).then(function (response) {
        return response.json();
      }).then(function (data) {
        return _this4.openDb().then(function (db) {
          var tx = db.transaction("restaurants", "readwrite").objectStore("restaurants").put(data);
          return tx.complete;
        }).catch(function (err) {
          console.error(err);
        });
      });
    }
  }, {
    key: "unfavorRestaurant",
    value: function unfavorRestaurant(id) {
      var _this5 = this;

      fetch("".concat(DBHelper.DATABASE_URL, "/").concat(id, "/?is_favorite=false"), {
        method: "PUT"
      }).then(function (response) {
        return response.json();
      }).then(function (data) {
        return _this5.openDb().then(function (db) {
          var tx = db.transaction("restaurants", "readwrite").objectStore("restaurants").put(data);
          return tx.complete;
        }).catch(function (err) {
          console.error(err);
        });
      });
    }
    /**
     * Fetch reviews for restaurant
     */

  }, {
    key: "fetchRestaurantReviews",
    value: function fetchRestaurantReviews(id) {
      var _this6 = this;

      var reviewPromise = new Promise(function (resolve, reject) {
        fetch(_this6.REVIEWS_URL + "?restaurant_id=".concat(id)).then(function (response) {
          return resolve(response.json());
        });
      }).catch(function (err) {
        return console.error(err);
      });
      return reviewPromise;
    }
  }, {
    key: "addRestaurantReview",
    value: function addRestaurantReview(review) {
      return fetch(this.REVIEWS_URL, {
        method: "POST",
        body: review
      }).then(function (response) {
        return console.log(response.json());
      }).catch(function (err) {
        return console.error(err);
      });
    }
  }, {
    key: "deleteRestaurantReview",
    value: function deleteRestaurantReview(id) {
      return fetch("".concat(this.REVIEWS_URL).concat(id), {
        method: "DELETE"
      });
    }
    /**
     * Restaurant page URL.
     */

  }, {
    key: "urlForRestaurant",
    value: function urlForRestaurant(restaurant) {
      return "./restaurant.html?id=".concat(restaurant.id);
    }
    /**
     * Restaurant image URL.
     */

  }, {
    key: "imageUrlForRestaurantSmall",
    value: function imageUrlForRestaurantSmall(restaurant) {
      return "/responsive-img/".concat(restaurant.id, "-200-small-1x.jpg 200w\n     /responsive-img/").concat(restaurant.id, "-400-small-2x.jpg 400w");
    }
  }, {
    key: "imageSrcForRestaurant",
    value: function imageSrcForRestaurant(restaurant) {
      return "/responsive-img/".concat(restaurant.id, "-400-medium-1x.jpg");
    }
  }, {
    key: "imageUrlForRestaurant",
    value: function imageUrlForRestaurant(restaurant) {
      return "/responsive-img/".concat(restaurant.id, "-800-large-1x.jpg 800w,\n    /responsive-img/").concat(restaurant.id, "-400-medium-1x.jpg 400w,\n    /responsive-img/").concat(restaurant.id, "-200-small-1x.jpg 200w\n    ");
    }
    /**
     * Map marker for a restaurant.
     */

  }, {
    key: "mapMarkerForRestaurant",
    value: function mapMarkerForRestaurant(restaurant, map) {
      var marker = new google.maps.Marker({
        position: restaurant.latlng,
        title: restaurant.name,
        url: DBHelper.urlForRestaurant(restaurant),
        map: map,
        animation: google.maps.Animation.DROP
      });
      return marker;
    }
  }, {
    key: "DATABASE_URL",

    /**
     * Database URL.
     * Change this to restaurants.json file location on your server.
     */
    get: function get() {
      var port = 1337; // Change this to your server port

      return "http://localhost:".concat(port, "/restaurants");
    }
  }, {
    key: "REVIEWS_URL",
    get: function get() {
      var port = 1337;
      return "http://localhost:".concat(port, "/reviews/");
    }
  }]);

  return DBHelper;
}();

var restaurants, neighborhoods, cuisines;
var map;
var markers = [];
/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */

document.addEventListener("DOMContentLoaded", function (event) {
  fetchNeighborhoods();
  fetchCuisines();
  registerServiceWorker();
  document.getElementById("map").overflow = "initial";
});
/**
 * Fetch all neighborhoods and set their HTML.
 */

var fetchNeighborhoods = function fetchNeighborhoods() {
  DBHelper.fetchNeighborhoods(function (error, neighborhoods) {
    if (error) {
      // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
};
/* Register Service Worker */


var registerServiceWorker = function registerServiceWorker() {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      console.log("Service Worker registerd scope is: " + reg.scope);
    }, function (err) {
      console.log("OH NOOO!!!", err);
    });
  }
};
/**
 *  Set neighborhoods HTML.
 */


var fillNeighborhoodsHTML = function fillNeighborhoodsHTML() {
  var neighborhoods = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : self.neighborhoods;
  var select = document.getElementById("neighborhoods-select");
  neighborhoods.forEach(function (neighborhood) {
    var option = document.createElement("option");
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
};
/**
 * Fetch all cuisines and set their HTML.
 */


var fetchCuisines = function fetchCuisines() {
  DBHelper.fetchCuisines(function (error, cuisines) {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
};
/**
 * Set cuisines HTML.
 */


var fillCuisinesHTML = function fillCuisinesHTML() {
  var cuisines = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : self.cuisines;
  var select = document.getElementById("cuisines-select");
  cuisines.forEach(function (cuisine) {
    var option = document.createElement("option");
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
};
/**
 * Initialize Google map, called from HTML.
 */


window.initMap = function () {
  var loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });
  updateRestaurants();
};
/**
 * Update page and map for current restaurants.
 */


var updateRestaurants = function updateRestaurants() {
  var cSelect = document.getElementById("cuisines-select");
  var nSelect = document.getElementById("neighborhoods-select");
  var cIndex = cSelect.selectedIndex;
  var nIndex = nSelect.selectedIndex;
  var cuisine = cSelect[cIndex].value;
  var neighborhood = nSelect[nIndex].value;
  DBHelper.fetchRestaurantsOffline().then(function (restaurants) {
    self.restaurants = restaurants;
    resetRestaurants(restaurants);
    fillRestaurantsHTML();
  });
};
/**
 * Clear current restaurants, their HTML and remove their map markers.
 */


var resetRestaurants = function resetRestaurants(restaurants) {
  // Remove all restaurants
  self.restaurants = [];
  var ul = document.getElementById("restaurants-list");
  ul.innerHTML = ""; // Remove all map markers

  self.markers.forEach(function (m) {
    return m.setMap(null);
  });
  self.markers = [];
  self.restaurants = restaurants;
};
/**
 * Create all restaurants HTML and add them to the webpage.
 */


var fillRestaurantsHTML = function fillRestaurantsHTML() {
  var restaurants = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : self.restaurants;
  var ul = document.getElementById("restaurants-list");
  restaurants.forEach(function (restaurant) {
    ul.append(createRestaurantHTML(restaurant));
  });
  lazyLoading();
  addMarkersToMap();
};
/**
 * Create restaurant HTML.
 */


var createRestaurantHTML = function createRestaurantHTML(restaurant) {
  var li = document.createElement("li");
  var link = document.createElement("a");
  link.href = DBHelper.urlForRestaurant(restaurant);
  link.setAttribute("aria-hidden", "true");
  link.setAttribute("tabindex", "-1");
  li.append(link);
  var image = document.createElement("img");
  var datasrc = document.createAttribute("data-src");
  datasrc.value = DBHelper.imageSrcForRestaurant(restaurant);
  var datasrcset = document.createAttribute("data-srcset");
  datasrcset.value = DBHelper.imageUrlForRestaurant(restaurant);
  image.className = "restaurant-img";
  image.setAttributeNode(datasrc);
  image.setAttributeNode(datasrcset); // image.srcset = DBHelper.imageUrlForRestaurant(restaurant);

  image.alt = "".concat(restaurant.name, ", ").concat(restaurant.neighborhood);
  link.append(image);
  var name = document.createElement("h3");
  name.innerHTML = restaurant.name;
  li.append(name);
  var neighborhood = document.createElement("p");
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);
  var address = document.createElement("p");
  address.innerHTML = restaurant.address;
  li.append(address);
  var more = document.createElement("a");
  more.innerHTML = "View Details";
  more.href = DBHelper.urlForRestaurant(restaurant);
  li.append(more);
  return li;
};
/**
 * Add markers for current restaurants to the map.
 */


var addMarkersToMap = function addMarkersToMap() {
  var restaurants = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : self.restaurants;
  restaurants.forEach(function (restaurant) {
    // Add marker to the map
    var marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, "click", function () {
      window.location.href = marker.url;
    });
    self.markers.push(marker);
  });
};

var lazyLoading = function lazyLoading() {
  var lazyImages = document.querySelectorAll(".restaurant-img");
  var intersectionObserver = new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var lazyImage = entry.target;
        lazyImage.src = lazyImage.dataset.src;
        lazyImage.srcset = lazyImage.dataset.srcset;
        intersectionObserver.unobserve(lazyImage);
      }
    });
  });
  lazyImages.forEach(function (lazyImage) {
    intersectionObserver.observe(lazyImage);
  });
};

var restaurant;
var map;
/*
 * Register Service Worker
*/

registerServiceWorker = (_readOnlyError("registerServiceWorker"), function () {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      console.log("Service Worker registerd scope is: " + reg.scope);
    }, function (err) {
      console.log("OH NOOO!!!", err);
    });
  }
});
/**
 * Initialize Google map, called from HTML.
 */

window.initMap = function () {
  var id = getParameterByName("id");

  if (!id) {
    console.error("No Id in the URL");
    return;
  } else {
    DBHelper.fetchRestaurantByIdOffline(id).then(function (restaurant) {
      self.restaurant = restaurant;
      fillRestaurantHTML();
      self.map = new google.maps.Map(document.getElementById("map"), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      var form = document.getElementById("review-form");
      enableReviewForm(form);
      enableCloseReviewForm(form);
      registerServiceWorker();
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    });
  }
};
/**
 * Create restaurant HTML and add it to the webpage
 */


var fillRestaurantHTML = function fillRestaurantHTML() {
  var restaurant = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : self.restaurant;
  var name = document.getElementById("restaurant-name");
  name.innerHTML = restaurant.name;
  var heart = document.getElementById("heart");

  if (self.restaurant.is_favorite) {
    heart.style.fill = "red";
  }

  heart.addEventListener("click", function () {
    if (restaurant.is_favorite) {
      heart.style.fill = "grey";
      DBHelper.favorRestaurant(self.restaurant.id);
    } else {
      heart.style.fill = "red";
      DBHelper.favorRestaurant(self.restaurant.id);
    }
  });
  var address = document.getElementById("restaurant-address");
  address.innerHTML = restaurant.address;
  var image = document.getElementById("restaurant-img");
  image.className = "restaurant-img";
  image.src = DBHelper.imageSrcForRestaurant(restaurant);
  image.srcset = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = "".concat(restaurant.name, ",\n   ").concat(restaurant.neighborhood);
  var cuisine = document.getElementById("restaurant-cuisine");
  cuisine.innerHTML = restaurant.cuisine_type; // fill operating hours

  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  } // fill reviews


  fillReviewsHTML();
};
/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */


var fillRestaurantHoursHTML = function fillRestaurantHoursHTML() {
  var operatingHours = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : self.restaurant.operating_hours;
  var hours = document.getElementById("restaurant-hours");

  for (var key in operatingHours) {
    var row = document.createElement("tr");
    var day = document.createElement("td");
    day.innerHTML = key;
    row.appendChild(day);
    var time = document.createElement("td");
    time.innerHTML = operatingHours[key];
    row.appendChild(time);
    hours.appendChild(row);
  }
};
/**
 * Create all reviews HTML and add them to the webpage.
 */


var fillReviewsHTML = function fillReviewsHTML() {
  var container = document.getElementById("reviews-container");
  DBHelper.fetchRestaurantReviews(self.restaurant.id).then(function (reviews) {
    if (!reviews) {
      var noReviews = document.createElement("p");
      noReviews.innerHTML = "No reviews yet!";
      container.appendChild(noReviews);
      return;
    }

    var ul = document.getElementById("reviews-list");
    ul.innerHTML = "";
    reviews.forEach(function (review) {
      ul.appendChild(createReviewHTML(review));
    });
    container.appendChild(ul);
  });
};
/**
 * Create review HTML and add it to the webpage.
 */


var createReviewHTML = function createReviewHTML(review) {
  var li = document.createElement("li");
  var liHeader = document.createElement("div");
  liHeader.className = "review-header";
  li.appendChild(liHeader);
  var name = document.createElement("p");
  name.className = "name";
  name.innerHTML = review.name;
  liHeader.appendChild(name);
  var date = document.createElement("p");
  var writtenAt = new Date(review.updatedAt).toDateString().split(" ");
  date.className = "date";
  date.innerHTML = writtenAt[2] + ". " + writtenAt[1] + ", " + writtenAt[3];
  liHeader.appendChild(date);
  var rating = document.createElement("p");
  rating.className = "rating";
  rating.innerHTML = "Rating: ".concat(review.rating);
  li.appendChild(rating);
  var comments = document.createElement("p");
  comments.className = "comments";
  comments.innerHTML = review.comments;
  li.appendChild(comments);
  var submitButton = document.getElementById("submit-review");
  submitButton.onclick = submitForm;
  return li;
};

var submitForm = function submitForm() {
  var review = new FormData();
  var form = document.getElementById("review-form");
  review.append("restaurant_id", self.restaurant.id);
  var nameInput = document.getElementById("name");
  var name = nameInput.value;
  if (!name) return;
  review.append("name", name);
  var ratingInput = document.getElementById("rating");
  var commentsInput = document.getElementById("comment");
  var successMessage = document.querySelector(".success-message");
  var offlineMessage = document.querySelector(".offline-message");
  var rating = ratingInput.value;
  var comments = commentsInput.value;
  review.append("rating", rating);
  if (!rating) return;
  review.append("comments", comments);

  if (navigator.onLine) {
    DBHelper.addRestaurantReview(review).then(function () {
      nameInput.value = "";
      ratingInput.value = 0;
      commentsInput.value = "";
      form.style.display = "none";
      fillReviewsHTML();
      successMessage.style.display = "block";
      setTimeout(function () {
        successMessage.style.display = "none";
      }, 2000);
    });
  } else {
    var reviewData = {
      restaurant_id: self.restaurant.id,
      name: name,
      rating: rating,
      comments: comments,
      createdAt: Date.now()
    };
    return DBHelper.openDb().then(function (db) {
      var tx = db.transaction("reviews", "readwrite");
      var store = tx.objectStore("reviews");
      store.put(reviewData);
      return tx.complete;
    }).then(function () {
      nameInput.value = "";
      ratingInput.value = 0;
      commentsInput.value = "";
      form.style.display = "none";
      offlineMessage.style.display = "block";
      setTimeout(function () {
        offlineMessage.style.display = "none";
      }, 4000);
    });
  }
};
/**
 * Add restaurant name to the breadcrumb navigation menu
 */


var fillBreadcrumb = function fillBreadcrumb() {
  var restaurant = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : self.restaurant;
  var breadcrumb = document.getElementById("breadcrumb");
  var li = document.createElement("li");
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
};
/*
 * Create page if there is no id
 */


var createEmptyPage = function createEmptyPage() {
  var textarea = document.getElementById("restaurant-container");
  var text = document.createElement("p");
  var cuisineBox = document.getElementById("restaurant-cuisine");
  cuisineBox.hidden = "true";
  text.innerHTML = "This page doesn't exist!";
  text.style.marginLeft = "20px";
  text.style.marginRight = "20px";
  textarea.appendChild(text);
};
/**
 * Get a parameter by name from page URL.
 */


var getParameterByName = function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]".concat(name, "(=([^&#]*)|&|#|$)")),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
};

var enableReviewForm = function enableReviewForm(form) {
  var button = document.getElementById("review-btn");

  button.onclick = function () {
    form.style.display = "block";
  };
};

var enableCloseReviewForm = function enableCloseReviewForm(form) {
  var close = document.querySelector(".modal-close");

  close.onclick = function () {
    return form.style.display = "none";
  };
};

window.addEventListener("online", function () {
  return DBHelper.openDb().then(function (db) {
    var tx = db.transaction("reviews", "readonly");
    var store = tx.objectStore("reviews");
    return store.getAll();
  }).then(function (reviews) {
    if (reviews && reviews.length > 0) {
      return Promise.all(reviews.map(function (review) {
        var reviewData = new FormData();
        reviewData.append("restaurant_id", review.restaurant_id);
        reviewData.append("name", review.name);
        reviewData.append("rating", review.rating);
        reviewData.append("createdAt", review.createdAt);
        reviewData.append("comments", review.comments);
        return fetch(DBHelper.REVIEWS_URL, {
          method: "POST",
          body: reviewData
        }).then(function (response) {
          return response.json;
        }).then(function (data) {
          if (data) {
            DBHelper.openDb().then(function (db) {
              var tx = db.transaction("reviews", "readwrite");
              var store = tx.objectStore("reviews");
              return store.delete(review.id);
            }).then(fillReviewsHTML);
          }
        });
      }));
    }
  });
});