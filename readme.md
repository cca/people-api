# People API for CCA Portal

Use the "people" Elasticsearch endpoint as a public API [from Portal](https://portal.cca.edu/people/). The Instructional Support team has a need to pull accurate lists of program administrators (faculty chairs & co-chairs, staff program managers & senior managers) complete with contact information. Portal has this data and exposes it in a machine-readable format.

## Usage

```txt
usage: app.py [-h] [-s, --staff] [-f, --faculty] [-n, --no-header]
              [-j, --json]

Pull program chair and manager information from the Portal People Directory. Writes CSV text to stdout by default.

optional arguments:
  -h, --help       show this help message and exit
  -s, --staff      whether to search staff profiles
  -f, --faculty    whether to search faculty profiles
  -n, --no-header  omit the CSV header row
  -j, --json       write full JSON data from Portal to stdout. Only works with
                   one of --staff or --faculty.

Examples:
  python app.py -s -f > data/out.csv # print a CSV of all PMs & Chairs
  python app.py --staff > data/stf.json # write complete staff search JSON to file
```

The command `pipenv run build` copies the latest data for staff and faculty to our clipboard, with no header row, then opens the Google Sheet that the Instructional Support team uses where we can paste in the updated data.

## License

[ECL-2.0](https://opensource.org/licenses/ECL-2.0)
