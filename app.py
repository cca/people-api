import argparse
import csv
import json
import re
import sys

import requests

examples = """Examples:
  python app.py -s -f > data/out.csv # create a CSV of all PMs & Chairs
  python app.py --staff --json > data/stf.json # write complete staff search JSON to file
  python app.py --pm # print only PM staff to stdout
"""
parser = argparse.ArgumentParser(
    formatter_class=argparse.RawDescriptionHelpFormatter,
    description="Pull program chair, program manager, and studio manager information from the Portal People Directory. Writes CSV text to stdout by default.",
    epilog=examples,
)
parser.add_argument(
    "-s",
    "--staff",
    dest="staff",
    action="store_true",
    help="whether to search staff profiles",
)
group = parser.add_mutually_exclusive_group()
group.add_argument(
    "--sm",
    dest="sm",
    action="store_true",
    help="search staff but only for Studio Managers",
)
group.add_argument(
    "--pm",
    dest="pm",
    action="store_true",
    help="search staff but only for Program Managers",
)
parser.add_argument(
    "-f",
    "--faculty",
    dest="faculty",
    action="store_true",
    help="whether to search faculty profiles",
)
parser.add_argument(
    "-n",
    "--no-header",
    dest="no_header",
    action="store_true",
    help="omit the CSV header row",
)
parser.add_argument(
    "-j",
    "--json",
    dest="json",
    action="store_true",
    help="write full JSON data from Portal to stdout. Only works with one of --staff or --faculty.",
)
args = parser.parse_args()

if args.staff and args.faculty and args.json:
    raise Exception("JSON output only works with staff OR faculty, not with both.")

url = "https://portal.cca.edu/search/people/_search"
headers = {
    "accept": "application/json",
    "content-type": "application/json",
}
manager = re.compile("[a-z]* manager", flags=re.I)
pgram = re.compile(" Program", flags=re.I)
writer = csv.writer(sys.stdout, delimiter="\t")


def pm(p):
    # find useful data in person record for program managers

    # handle multiple positions
    for pos in p["positions"]:
        if "program manager" in pos.lower() or "senior manager" in pos.lower():
            position = pos

    # parse out the academic program, positions look like this
    # "Program Manager: Humanities & Sciences, Writing & Literature and Graduate Comics, Humanities and Sciences"
    # so we ignore everything _before_ the first comma & _after_ the last comma
    pos_list = position.split(", ")
    # handle Kris McGhee exception: programs were split with a comma & not an "and"
    # https://portal.cca.edu/people/kris.mcghee/
    if len(pos_list) == 4:
        program = re.sub(".*:", "", "; ".join(pos_list[1:3]))
    else:
        program = position.split(", ")[1].replace(" and ", "; ")
    position = manager.match(position)[0]

    # some people don't have emails? but everyone has a username
    return [p["full_name"], p["username"] + "@cca.edu", position, program]


def sm(p):
    # find useful data in person record for studio managers

    # program is hidden in first position somewhere in a wildly inconsistent manner
    # but if we can strip out "Studio Manager" and "Studio Operations" then program
    # is _usually_ the only thing left
    program = (
        p["positions"][0]
        .replace(", Studio Operations", "")
        .replace("Studio Manager", "")
        .replace("Studio Operations Manager", "")
        .strip(",")
        .strip(" -")
        .strip()
    )

    # some people don't have emails? but everyone has a username
    return [p["full_name"], p["username"] + "@cca.edu", "Studio Manager", program]


def chair(p):
    # find useful data in person record for program chair, co-chair

    # chairs tend to have multiple positions, they look like this:
    # "Assistant Chair, Illustration Program"
    # let's hope no one ever has a chair _and_ asst. chair role
    # create a list of all programs, set gives free deduplication
    for pos in p["positions"]:
        if "chair" in pos.lower():
            # handle Sandrine Lebas exception: "Chair. Industrial Design Program, Industrial Design Program"
            # https://portal.cca.edu/people/slebas/
            if "." in pos:
                position = pos.split(". ")[0]
            else:
                position = pos.split(", ")[0]
            break

    programs = set(
        [p.replace(" Program", "") for p in p["get_faculty_programs_filter"]]
    )
    return [
        p["full_name"],
        p["username"] + "@cca.edu",
        position,
        "; ".join(list(programs)),
    ]


def handle_json(d):
    if args.json:
        print(json.dumps(d, indent=2))
        exit(0)


# if we're printing to CSV, add a header row
if not args.json and not args.no_header:
    writer.writerow(["Name", "Email", "Role", "Program(s)"])

# staff: get program managers
if args.staff or args.sm or args.pm:
    query = {
        "query": {
            "simple_query_string": {
                # search term
                "query": "manager",
                "fields": [
                    "full_name^5",
                    "positions^5",
                    "get_staff_departments",
                    "username",
                ],
                "default_operator": "AND",
            }
        },
        # other filters are Faculty and Student
        "post_filter": {"term": {"usertype_filter": "Staff"}},
        "size": 60,
        "sort": [{"_score": "desc"}, {"get_last_name_filter": "asc"}],
    }
    r = requests.post(url, json=query, headers=headers)
    if r.status_code == 200:
        data = r.json()
        handle_json(data)
        for result in data["hits"]["hits"]:
            person = result["_source"]
            if (args.staff or args.sm) and person[
                "staff_primary_department"
            ].lower() == "studio operations":
                writer.writerow(sm(person))
            elif args.staff or args.pm:
                for position in person["positions"]:
                    if (
                        "program manager" in position.lower()
                        or "senior manager" in position.lower()
                    ):
                        writer.writerow(pm(person))
                        break
    else:
        print("ERROR: HTTP {}".format(r.status_code))
        print(r.text)
        r.raise_for_status()

# faculty: get chairs, co-chairs
if args.faculty:
    query = {
        "query": {
            "simple_query_string": {
                # search term
                "query": "chair",
                "fields": [
                    "full_name^5",
                    "get_faculty_programs",
                    "positions^5",
                    "username",
                ],
                "default_operator": "AND",
            }
        },
        "post_filter": {"term": {"usertype_filter": "Faculty"}},
        "size": 60,
        "sort": [{"_score": "desc"}, {"get_last_name_filter": "asc"}],
    }
    r = requests.post(url, json=query, headers=headers)
    if r.status_code == 200:
        data = r.json()
        handle_json(data)
        for result in data["hits"]["hits"]:
            person = result["_source"]
            for position in person["positions"]:
                if "chair" in position.lower():
                    writer.writerow(chair(person))
                    break
    else:
        print("ERROR: HTTP {}".format(r.status_code))
        print(r.text)
        r.raise_for_status()
