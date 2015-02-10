var TSVReaderModule;
(function TSVReaderModuleLoader_closure(window)
{
  var loader = function(module_name, element)
  {
    var self = this;
    self.element = element;
    self.module_name = module_name;
  }

  var p = loader.prototype;

  p.load = function(callback)
  {
    var self = this,
    prefix = assets + '/tsvreader_modules/' + self.module_name + '/',
    res = {};
    async.parallel([
      function(cb)
      {
        TSVReaderModule = {
          name: self.module_name,
          element: self.element,
          dirname: prefix
        };
        TSVReaderModule = $.extend(false, TSVReaderModule, self.supply);
        var s = document.createElement('script');
        s.type = 'text/javascript';
        s.async = true;
        s.src = prefix + self.module_name + '.js';
        document.getElementsByTagName('head')[0].appendChild(s);
        s.onload = function()
        {
          cb();
        };
        s.onerror = function()
        {
          var err = sprintf(_("Request for module has failed!"));
          cb(err);
        }
      }
    ], function(err)
       {
         if(err)
           return callback && callback(err);

         function make_css_loader(url_str)
         {
           return function(cb)
           {
             load_css_file(url_str, cb);
           }
         }
         var css_files = TSVReaderModule.include_css_files || [],
         css_files_loader = css_files.map(make_css_loader);

         async.parallel(css_files_loader, function()
           {
             TSVReaderModule.ready();
             callback && callback(err);
           });
       });

  }

  function load_css_file(url_str, cb)
  {
    var link = newEl('link'),
    r;
    $(link).attr('href', url_str)
      .attr('rel', 'stylesheet')
      .attr('type', 'text/css');
    $('head').append(link);
    // handle load event
    link.onreadystatechange = link.onload = function () {
      if(!r && (!this.readyState || this.readyState == 'complete'))
      {
        r = true;
        if(cb)
          cb();
      }
    }
    var sheet, cssRules;
    // get the correct properties to check for depending on the browser
    if('sheet' in link ) {
      sheet = 'sheet';
      cssRules = 'cssRules';
    }
    else {
      sheet = 'styleSheet';
      cssRules = 'rules';
    }
    var interval_id = link._load_interval_id = setInterval( function() {
      try {
        if (link[sheet] && link[sheet][cssRules].length)
        {
          clearInterval(interval_id);
          link._load_interval_id = undefined;
          if(!r)
          {
            r = true;
            if(cb)
              cb();
          }
        }
      } catch( e ) {}
    }, 10);

    return link;
  }

  window.TSVReaderModuleLoader = loader;
})(window);
