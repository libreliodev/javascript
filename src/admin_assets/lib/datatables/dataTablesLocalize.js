(function(){
update();
$(document).on('localize-locale-changed', update);
function update()
{
  console.log('update oLang');
  var oLang = $.fn.dataTable.defaults.oLanguage;
  if(oLang)
    oLangLocalize(oLang, 'dataTables');
}
function oLangLocalize(oLang, prefix)
{
  for(var p in oLang)
    if(typeof oLang[p] == 'string' && oLang[p].length > 0)
      oLang[p] = localize(prefix + '_' + p);
    else if(typeof oLang[p] == 'object')
      oLangLocalize(oLang[p], prefix + '_' + p);
}

})();
