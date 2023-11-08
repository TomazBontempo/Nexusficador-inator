function processData() {
  const fileInput1 = document.getElementById("fileInput1");
  const fileInput2 = document.getElementById("fileInput2");

  const file1 = fileInput1.files[0];
  const file2 = fileInput2.files[0];

  if (!file1 || !file2) {
    alert("Please select both files.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (event) {
    const data1 = event.target.result;
    const reader2 = new FileReader();

    reader2.onload = function (event) {
      const data2 = event.target.result;

      // Process the data with the provided processing function
      const processedData = processDataFiles(data1, data2);

      // Download the processed data as a text file
      downloadFile(processedData, "Nexus Script.nex", "text/plain");
    };

    reader2.readAsText(file2);
  };

  reader.readAsText(file1);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function processDataFiles(data1, data2) {
  console.log("Starting to read the file...");

  const lines = data1.split("\n");
  const table = lines
    .map((line) => {
      if (line.trim() === "") return null; // skip empty lines

      let [name, sequence] = line.split(/\s+/);
      const nucleotides = sequence.split("");

      return [name, ...nucleotides];
    })
    .filter((row) => row !== null); // remove null rows

  // Find the maximum number of digits in the group names
  const maxDigits = Math.max(
    ...table.map((row) => row[0].match(/(\d+)$/)[1].length)
  );

  console.log(
    "Data processed successfully. Starting to compare the columns..."
  );

  const newTable = [];
  for (let col = 1; col < table[0].length; col++) {
    // start from 1 to ignore the group name column
    let different = false;
    for (let row = 1; row < table.length; row++) {
      // start from 1 to compare with the first row
      if (
        table[row][col] !== table[0][col] &&
        table[row][col] !== "-" &&
        table[0][col] !== "-"
      ) {
        different = true;
        break;
      }
    }

    if (different) {
      newTable.push(table.map((row) => row[col]));
    }
  }

  console.log(
    "Columns compared successfully. Starting to transpose the table..."
  );

  const transposed = newTable[0].map((col, i) => newTable.map((row) => row[i]));

  console.log(
    "Table transposed successfully. Adding group names as the first column..."
  );

  const finalTable = transposed.map((row, i) => {
    // Pad the group names with 0s to ensure they all have the same number of digits
    let groupName = table[i][0];
    const match = groupName.match(/(\d+)$/);
    if (match) {
      const number = match[1].padStart(maxDigits, "0");
      groupName = groupName.replace(/(\d+)$/, number);
    }

    return [groupName].concat(row.join(""));
  });

  console.log(
    "Group names added successfully. Storing the final table and group names in variables..."
  );

  // Define the groupNames variable
  const groupNames = finalTable.map((row) => row[0]).join("\n");

  const result = finalTable.map((row) => row.join(" ")).join("\n");

  // Store the number of groups and the length of the sequence
  const numGroups = finalTable.length;
  const sequenceLength = finalTable[0][1].length; // subtract 1 because the first element is the group name

  const regex = /\]\s*\n\s*\n\s*Hap_1:/;
  const match2 = data2.match(regex);

  if (match2) {
    console.log("Match found.");

    const startIndex2 = match2.index + match2[0].length - "Hap_1:".length;
    const endIndex2 = data2.length; // We'll read until the end of the file
    const extractedData2 = data2.slice(startIndex2, endIndex2);

    console.log("Data extracted.");

    // Split the extracted data into lines
    const lines2 = extractedData2.split("\n");

    // Prepare an array to hold the table data
    let tableData2 = [];
    let locationsSet2 = new Set();

    let maxDigitsInGroupIndex2 = maxDigits;

    // Process each line
    for (let line of lines2) {
      // Split the line into parts
      const parts2 = line.split(":");
      if (parts2.length < 2) continue;

      // Get the group name
      let group2 = parts2[0].trim();
      let groupIndexStr2 = group2.split("_")[1];
      maxDigitsInGroupIndex2 = Math.max(
        maxDigitsInGroupIndex2,
        groupIndexStr2.length
      );

      // Get the names and locations
      const namesAndLocations2 = parts2[1]
        .split("[")[1]
        .split("]")[0]
        .split(" ");

      for (let i = 0; i < namesAndLocations2.length; i++) {
        // Get the name and location
        let nameLocation2 = namesAndLocations2[i].split("-");
        let name2 = nameLocation2[0];
        let location2 = nameLocation2[1];

        // Add the location to the set of locations
        if (location2 !== undefined) {
          locationsSet2.add(location2);
        }

        // Add the data to the table
        if (location2 !== undefined) {
          tableData2.push({
            name: name2,
            location: location2,
            group: group2,
          });
        }
      }
    }

    console.log("Table data prepared");

    // Create a new table with locations as headers and groups as rows
    let newTableData2 = {};
    let locationsArray2 = Array.from(locationsSet2);

    for (let row of tableData2) {
      let groupIndexStr3 = row.group.split("_")[1];

      while (groupIndexStr3.length < maxDigitsInGroupIndex2) {
        groupIndexStr3 = "0" + groupIndexStr3;
      }

      row.group = "Hap_" + groupIndexStr3;

      if (!newTableData2[row.group]) {
        newTableData2[row.group] = {};
      }

      for (let location of locationsArray2) {
        if (row.location !== undefined) {
          newTableData2[row.group][location] = tableData2.filter(
            (r) => r.group === row.group && r.location === location
          ).length;
        }
      }
    }

    console.log("New table data prepared");
    console.log(newTableData2);

    // Store headers in a variable
    let headersText2 = locationsArray2.join(" ");

    console.log("Headers:");
    console.log(headersText2);

    // Print the new table data as text without headers and without spaces, but with commas between numbers
    let outputText2 = "";

    for (let group in newTableData2) {
      outputText2 += group + " ";

      for (let i = 0; i < locationsArray2.length; i++) {
        if (newTableData2[group][locationsArray2[i]] !== undefined) {
          outputText2 += newTableData2[group][locationsArray2[i]];
        } else {
          outputText2 += "0"; // Use 0 for undefined locations
        }

        if (i < locationsArray2.length - 1) {
          outputText2 += ",";
        }
      }

      outputText2 += "\n";
    }

    // Count the numbers in the sequence inside outputText2
    const numberCount = outputText2.split("\n")[0].split(",").length;
    console.log(`Number of numbers in the sequence: ${numberCount}`);

    console.log("Final output:");
    console.log(outputText2);

    return `#NEXUS

BEGIN TAXA;
DIMENSIONS NTAX=${numGroups};
TAXLABELS

${groupNames}

;
END;


BEGIN CHARACTERS;
DIMENSIONS NCHAR=${sequenceLength};
FORMAT DATATYPE=DNA  MISSING=? GAP=-;

MATRIX

${result}

;
END;


BEGIN TRAITS;

Dimensions NTRAITS=${numberCount};
Format labels=yes missing=? separator=Comma;
TraitLabels ${headersText2};
Matrix

${outputText2}

;
`;
  }
}
