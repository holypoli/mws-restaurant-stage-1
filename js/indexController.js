import idb from 'idb';

class indexController {

  /**
   * open new idb
   */
  
  static openDatabase() {
    if (!navigator.serviceWorker) {
      return Promise.resolve;
    }
    
    return idb.open('restaurants', 1, (upgradeDb) => {
      let storage = upgradeDb.createObjectStore('restaurants')
    });
  }
}
  