function openPublicationDialog(opts, cb2)
{
  var cb = function()
  {
    funcListCall(releaser);
    cb2.apply(this, arguments);
  }
  function getPubType(pub, cb)
  {
    s3ObjectExists(awsS3, {
      Bucket: config.s3Bucket,
      Key: app_dir + '/' + pub + '/' + pub + '_' + ext
    }, function(err, exists)
       {
         if(err)
           return cb && cb(err);
         cb && cb(null, exists ? 'Paid' : 'Free');
       });
  }
  function setPage(page)
  {
    var pages = [ 'select-publication', 'select-type' ];
    for(var i = 0, l = pages.length; i < l; ++i)
    {
      var cpage = pages[i];
      $dlg.toggleClass(cpage + '-page', cpage == page);
    }
  }
  function endProc(pub, type)
  {
    $dlg.modal('hide');
    cb(undefined, {
      name: pub,
      key: app_dir + '/' + pub + '/' + pub + (type == 'Paid' ? '_' : '') + ext
    });
  }
  function updateTypesFor(pub)
  {
    var types = [ 
      {
        name: 'Free'
      },
      {
        name: 'Paid'
      }
    ],
    list = $dlg.find('.types-list').empty();
    forEach(types, function(type)
      {
        type.select = function()
        {
          endProc(pub, type.name);
          return false;
        };
        list.dhtml('list_new_item', 'default', type).appendTo(list);
      });
  }
  function selectPublication(name)
  {
    getPubType(name, function(err, type)
      {
        if(err)
          return cb(err);
        if(type == 'Paid')
        {
          updateTypesFor(name);
          setPage('select-type');
        }
        else
          endProc(name, type);
      });
  }
  function updatePublications(pubs)
  {
    var list = $dlg.find('.publications-list').empty();
    forEach(pubs, function(pub)
      {
        var item =  {
          name: pub,
          select: function(){ selectPublication(pub); return false; }
        };
        list.dhtml('list_new_item', 'default', item).appendTo(list);
      });
  }
  var app_dir = opts.app_dir,
  ext = opts.extension || '',
  $dlg = $('#librelio-open-publication-dlg'),
  releaser = [];
  $dlg.modal('show');
  on($dlg, releaser, 'hidden.bs.modal', function()
    {
      cb();
    })
  if(!$dlg.data('pub_initialized'))
  {
    $dlg.find('.publications-list,.types-list').dhtml('list_init');
    $dlg.data('pub_initialized', true);
  }
  setPage('select-publication');
  $dlg.find('.publications-list,.types-list').empty();
  listPublications(awsS3, {
    Bucket: config.s3Bucket,
    Prefix: app_dir
  }, function(err, pubs)
     {
       if(err)
         return cb(err);
       updatePublications(pubs);
     });
}
