initialize_reader(function(app_data, tsv_url, tsv_url_dir, 
                           external_b, doc_query)
  {
    if(!tsv_url)
      return;
    var tmpl_url = template_url(app_data, tsv_url, tsv_url_dir, 
                                external_b, doc_query),
    doc_query = querystring.parse(get_url_query(document.location+'')),
    module_name = doc_query.wamodule,
    tsvreader_el = document.getElementById('tsvreader');
    if(!module_name)
    {
      alert("No module has selected");
      return;
    }
    var moduleLoader = new TSVReaderModuleLoader(module_name, tsvreader_el);
    moduleLoader.supply = {
      doc_query: doc_query,
      tmpl_url: tmpl_url,
      tsv_url: tsv_url,
      app_data: app_data
    };
    moduleLoader.load(function(err)
      {
        
      });
  });
function template_url(app_data, tsv_url, tsv_url_dir, external_b, doc_query)
{
  /* We don't use watmpl
    if(doc_query.watmpl)
    return reader_url_eval(doc_query.watmpl, external_b, app_data);
  */
  return TSVReader.template_url(tsv_url, tsv_url_dir);
}
