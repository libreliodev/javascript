#!/usr/bin/python
#
# mirror LocalePlanet scripts
#

import json
import optparse
import os
import polib
import re
import string
import sys
import urllib2

parser = optparse.OptionParser(usage="usage: %prog [options]")
parser.add_option("--locale", default="*", dest="locale", help="list of locales (or * for all)")
parser.add_option("--output", default=".", dest="output", help="output directory (default = current)")
parser.add_option("--querystring", default="", dest="querystring", help="query string to pass when downloading script")
parser.add_option("--quiet", action="store_false", default=True, dest="verbose", help="don't print status messages to stdout")
parser.add_option("--server", default="www.localeplanet.com", dest="server", help="server to download from")
parser.add_option("--script", default="icu.js", dest="script", help="script to download")

(options, args) = parser.parse_args()

locales = []
if options.locale == '*':
	f = urllib2.urlopen("http://" + options.server + "/api/codelist.json")
	str_list = f.read()
	f.close()
	
	locales = json.loads(str_list)
else:
	locales = options.locale.split(',')
	
for locale in locales:
	
	if options.verbose:
		print("Processing %s" % locale)

	f = urllib2.urlopen("http://" + options.server + "/api/" + locale + "/" + options.script + "?" + options.querystring)
	data = f.read()
	f.close()
	if options.verbose:
		print("Downloaded %d bytes" % len(data))
	
	filename = os.path.join(options.output, os.path.splitext(options.script)[0] + "_" + locale + ".js")
	if options.verbose:
		print("Saving to %s" % filename)
		
	f = open(filename, "w")
	f.write(data)
	f.close()