initialize_reader(function(app_data, table_url, table_url_dir, 
                           external_b, doc_query)
  {
    if(!reader_supported())
      return reader_notify_not_supported(app_data);
    if(!table_url)
      return;
    var tableReader = new TableReader({
      element: document.getElementById('tablereader')
    });
    tableReader.load(table_url, function(err)
      {
        if(err)
          return notifyError(err);
      });
  });
