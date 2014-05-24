(function(window){
var lStorage = localStorage,
sStorage = sessionStorage;
if(lStorage || sStorage)
{
    var storage = {
        type: 'local'
    };
    storage.getItem = function(key)
    {
        if(lStorage)
        {
            if(storage.type == 'session')
                return sStorage.getItem(key);
            return lStorage.getItem(key);
        }
        return sStorage.getItem(key);
    }
    storage.setItem = function(key, val)
    {
        if(lStorage)
        {
            if(storage.type == 'session')
                return sStorage.setItem(key, val);
            return lStorage.setItem(key, val);
        }
        return sStorage.getItem(key, val);
    }
    window.storage = storage;
}

})(window);
