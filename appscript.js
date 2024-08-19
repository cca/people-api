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
  , pm_pattern = /(senior )?(program|project) manager/i
  , pgram = / Program/i
  , fields = ["Name","Email","Role","Program(s) or Department"];

function pm(p) {
  // find useful data in person record for program managers
  let position = p.positions.filter(pos => pos.match(pm_pattern))[0]
  let program = null
  // parse out the academic program, positions look like this
  // "Project Manager, Humanities & Sciences, Academic Affairs"
  // Handle "Senior Project Manager for Department" exception:
  if (position.match(" for ")) {
    let pos_prog = position.split(" for ")
    position = pos_prog[0]
    program = pos_prog[1].split(", ")[0]
  } else {
    program = position.split(', ')[1]
    position = position.match(pm_pattern)[0]
  }

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
  let position, programs = new Set()
  p.positions.forEach(pos => {
    if (pos.toLowerCase().match("chair")) {
        position = pos.split(", ")[0]
        program = pos.split(", ")[1]
        // trim " Program" off the end of string
        program = program.replace(pgram, '')
        programs.add(program)
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
              "positions^5",
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
    } else if (person.positions.some(p => p.match(pm_pattern))) {
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
  // update whole range at once instead of iterating with sheet.appendRow()
  sheet.getRange(2, 1, people.length, people[0].length).setValues(people)
}

function onOpen() {
  let ss = SpreadsheetApp.getActiveSpreadsheet()
  ss.addMenu("Refresh Data", [{name: "Update spreadsheet from Portal", functionName: "getPeopleData"}])
}
