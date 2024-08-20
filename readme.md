# People API for CCA Portal

Use the "people" Elasticsearch endpoint as a public API [from Portal](https://portal.cca.edu/people/). The Instructional Services & Technology team has a need to pull accurate lists of program administrators (faculty chairs & co-chairs, staff program managers & senior managers) complete with contact information. Portal has this data and exposes it in a machine-readable format.

Note that anyone with a private profile is excluded from the data.

## Google Apps Script

This project is [embedded in a spreadsheet](https://docs.google.com/spreadsheets/d/15Don1ZwZvkWeo2fhyUGCtQ54ASLLh3GbTF6AO-toYR4/edit?usp=sharing) as [an apps script](https://script.google.com/home/projects/1oYhIUeOs1OHI_UL4XfgEBenps0M_y2JKE8K3GDpgiiulkrBL0aKGCBnh/edit). It uses an "on open" trigger to add a "Refresh Data" menu to the spreadsheet, which lets us pull in data fresh from Portal. The "appscript.js" file is the source code of this program, minus the "on open" trigger which must be configured manually.

## Usage

```txt
usage: app.py [-h] [-s, --staff] [--sm | --pm] [-f, --faculty]
              [-n, --no-header] [-j, --json]

Pull program chair, project manager, and studio manager information from the Portal People Directory. Writes CSV text to stdout by default.

optional arguments:
  -h, --help       show this help message and exit
  -s, --staff      whether to search staff profiles
  --sm             search staff but only for Studio Managers
  --pm             search staff but only for Project/Program Managers
  -f, --faculty    whether to search faculty profiles
  -n, --no-header  omit the CSV header row
  -j, --json       write full JSON data from Portal to stdout. Only works with
                   one of --staff or --faculty.

Examples:
  python app.py --staff --json > data/stf.json # write complete staff search JSON to file
  python app.py --pm # print only PM staff to stdout
```

## License

[ECL-2.0](https://opensource.org/licenses/ECL-2.0)
