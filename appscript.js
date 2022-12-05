// https://github.com/cca/people-api

let url = "https://portal.cca.edu/search/people/_search"
  , http_options = {
      method: 'post',
      followRedirects: true,
      muteHttpExceptions: true,
      contentType: 'application/json',
      headers: {
        accept: 'application/json'
      }
    }
  , manager = /[a-z]* manager/i
  , pgram = / Program/i
  , fields = ["Name","Email","Role","Program(s) or Department"];

function pm(p) {
  // find useful data in person record for program managers
  let position = p.positions.filter(pos => pos.toLowerCase().match("program manager") || pos.toLowerCase().match("senior manager"))[0]
  // parse out the academic program, positions look like this
  // "Program Manager: Humanities & Sciences, Writing & Literature and Graduate Comics, Humanities and Sciences"
  // so we ignore everything _before_ the first comma & _after_ the last comma
  let program = null
  let pos_list = position.split(', ')
  // handle Kris McGhee exception: programs were split with a comma & not an "and"
  // https://portal.cca.edu/people/kris.mcghee/
  if (pos_list.length === 4) {
    program = pos_list[1].replace(/.*:/, '').trim() + '; ' + pos_list[2]
  } else {
    program = position.split(', ')[1].replace(" and ", "; ")
  }
  position = position.match(manager)[0]

  // some people don't have emails? but everyone has a username
  return [p.full_name, p.username + '@cca.edu', position, program ]
}

function sm(p) {
  // find useful data in person record for studio managers

  // program is hidden in first position somewhere in a wildly inconsistent manner
  // but if we can strip out "Studio Manager" and "Studio Operations" then program
  // is _usually_ the only thing left
  let program = p.positions[0].replace(', Studio Operations', '').replace('Studio Manager', '')
    .replace('Studio Operations Manager', '').replace(/^, /, '').replace(/^ -/, '').trim()
  return [ p.full_name, p.username + '@cca.edu', 'Studio Manager', program ]
}

function chair(p) {
  // find useful data in person record for program chair, co-chair

  // chairs tend to have multiple positions, they look like this:
  // "Assistant Chair, Illustration Program"
  // let's hope no one ever has a chair _and_ asst. chair role
  // create a list of all programs, set gives free deduplication
  let programs = new Set()
  p.positions.forEach(pos => {
    if (pos.toLowerCase().match("chair")) {
      // handle Sandrine Lebas exception: "Chair. Industrial Design Program, Industrial Design Program"
      // https://portal.cca.edu/people/slebas/
      if (pos.match(/\./)) {
        position =  pos.split(". ")[0]
        program = pos.split(", ")[1]
        // trim " Program" off the end of string
        program = program.replace(pgram, '')
        programs.add(program)
      } else {
        position = pos.split(", ")[0]
        program = pos.split(", ")[1]
        // trim " Program" off the end of string
        program = program.replace(pgram, '')
        programs.add(program)
      }
    }
  })

  return [ p.full_name, p.username + '@cca.edu', position, Array.from(programs).join('; ') ]
}

let staff_query = {
  "query": {
      "simple_query_string": {
          // search term
          "query": "manager",
          "fields": [
              "full_name^5",
              "get_faculty_programs",
              "positions^5",
              "get_majors",
              "get_staff_departments",
              "username",
          ],
          "default_operator": "AND",
      }
  },
  // other filters are Faculty and Student
  "post_filter": {"term": {"usertype_filter": "Staff"}},
  "size": 60,
  "sort": [{"_score": "desc"}, {"get_last_name_filter": "asc"}],
}
, faculty_query = {
    "query": {
        "simple_query_string": {
            // search term
            "query": "chair",
            "fields": [
                "full_name^5",
                "get_faculty_programs",
                "positions^5",
                "get_majors",
                "get_staff_departments",
                "username",
            ],
            "default_operator": "AND",
        }
    },
    "post_filter": {"term": {"usertype_filter": "Faculty"}},
    "size": 60,
    "sort": [{"_score": "desc"}, {"get_last_name_filter": "asc"}],
};

/**
 * Fetch data from Portal about faculty & staff
 *
 * @return [People] array of people arrays with ["name", "email", "role", "program"] data
 */
function getPeopleData() {
  let staff = getStaffData()
  let faculty = getFacultyData()
  let all = staff.concat(faculty)
  addPeopleToSheet(all)
}

function getStaffData() {
  http_options.payload = JSON.stringify(staff_query)
  let response = UrlFetchApp.fetch(url, http_options)
  let text = response.getContentText()
  let status = response.getResponseCode()
  if (status != 200) {
    return Logger.log(`Error fetching data from Portal. HTTP ${status}\n${text}`);
  }
  let data = JSON.parse(text)
  let staff = []
  data.hits.hits.forEach(d => {
    let person = d._source
    if (person.staff_primary_department.toLowerCase() === 'studio operations') {
      staff.push(sm(person))
    } else if (person.positions.some(p => p.toLowerCase().match("senior manager") || p.toLowerCase().match("program manager"))) {
      staff.push(pm(person))
    }
  })
  return staff
}

function getFacultyData() {
  http_options.payload = JSON.stringify(faculty_query)
  let response = UrlFetchApp.fetch(url, http_options)
  let text = response.getContentText()
  let status = response.getResponseCode()
  if (status != 200) {
    return Logger.log(`Error fetching data from Portal. HTTP ${status}\n${text}`);
  }
  let data = JSON.parse(text)
  let faculty = data.hits.hits.filter(d => d._source.positions.some(p => p.toLowerCase().match("chair")))
    .map(d => chair(d._source))
  return faculty
}

/**
 * Clears worksheet and inserts people rows
 *
 * @param {array} Array of people rows
 *
 * @return undefined (no return value)
 */
function addPeopleToSheet(people) {
  let sheet = SpreadsheetApp.getActiveSheet()
  // clear existing data
  sheet.clear()
  // header row
  sheet.appendRow(fields)
  people.forEach(p => sheet.appendRow(p))
}

function onOpen() {
  let ss = SpreadsheetApp.getActiveSpreadsheet()
  ss.addMenu("Refresh Data", [{name: "Update spreadsheet from Portal", functionName: "getPeopleData"}])
}
