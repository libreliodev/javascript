var Handlebars,
helpers = {
    jsonStringify: function(obj)
    {
        return new Handlebars.SafeString(typeof obj == 'object' ? JSON.stringify(obj) : 'undefined');
    }
};

// Export helpers
module.exports.register = function (hb, options) {
  Handlebars = hb;
  options = options || {};

  for (var helper in helpers) {
    if (helpers.hasOwnProperty(helper)) {
      Handlebars.registerHelper(helper, helpers[helper]);
    }
  }
};
