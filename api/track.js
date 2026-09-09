const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let query = req.method === 'POST' ? req.body.query : req.query.query;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Please provide mobile number or CNIC',
        format: 'Mobile: 03XXXXXXXXX or CNIC: 12345-1234567-1 or 1234512345671',
        credit: 'Credit: @AZ_Tricks (https://t.me/AZ_Tricks)'
      });
    }

    let cleanQuery = query.replace(/[^0-9]/g, '');
    
    if (cleanQuery.length < 10) {
      return res.status(400).json({
        error: 'Invalid input. Minimum 10 digits required',
        format: 'Mobile: 03XXXXXXXXX (11 digits) or CNIC: 12345-1234567-1 (13 digits)',
        credit: 'Credit: @AZ_Tricks (https://t.me/AZ_Tricks)'
      });
    }

    const response = await axios.post(
      'https://freshsimtracker.com/numberDetails.php',
      `numberCnic=${cleanQuery}&searchNumber=search`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
          'Host': 'freshsimtracker.com',
          'Origin': 'https://freshsimtracker.com',
          'Referer': 'https://freshsimtracker.com/',
          'X-Requested-With': 'mark.via.gp',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'Cache-Control': 'max-age=0',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 30000
      }
    );

    const html = response.data;
    const result = parseHTML(html, cleanQuery);
    const searchType = cleanQuery.length === 13 ? 'CNIC' : 'Mobile Number';
    
    return res.status(200).json({
      search_type: searchType,
      input: formatInput(cleanQuery),
      ...result,
      credit: 'Credit: @AZ_Tricks (https://t.me/AZ_Tricks)'
    });

  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      error: 'Service temporarily unavailable. Please try again later.',
      credit: 'Credit: @AZ_Tricks (https://t.me/AZ_Tricks)'
    });
  }
};

function parseHTML(html, query) {
  const result = {
    number: 'Not Found',
    name: 'Not Found',
    cnic: 'Not Found',
    address: 'Not Found',
    status: 'Failed',
    raw_data: []
  };

  try {
    const cleanHtml = html.replace(/\s+/g, ' ').replace(/<[^>]*>/g, ' ').trim();
    
    const patterns = {
      name: [
        /Name\s*[:：]\s*([^<\n]+)/i,
        /Full Name\s*[:：]\s*([^<\n]+)/i,
        /Customer Name\s*[:：]\s*([^<\n]+)/i,
        /Owner Name\s*[:：]\s*([^<\n]+)/i
      ],
      cnic: [
        /CNIC\s*[:：]\s*([0-9]{5}[-][0-9]{7}[-][0-9])/i,
        /NIC\s*[:：]\s*([0-9]{5}[-][0-9]{7}[-][0-9])/i,
        /ID Card\s*[:：]\s*([0-9]{5}[-][0-9]{7}[-][0-9])/i,
        /([0-9]{5}[-][0-9]{7}[-][0-9])/i,
        /([0-9]{13})/i
      ],
      address: [
        /Address\s*[:：]\s*([^<\n]+)/i,
        /Present Address\s*[:：]\s*([^<\n]+)/i,
        /Permanent Address\s*[:：]\s*([^<\n]+)/i,
        /Location\s*[:：]\s*([^<\n]+)/i
      ],
      number: [
        /Number\s*[:：]\s*([0-9+\- ]+)/i,
        /Mobile\s*[:：]\s*([0-9+\- ]+)/i,
        /Phone\s*[:：]\s*([0-9+\- ]+)/i
      ]
    };

    Object.keys(patterns).forEach(key => {
      for (let pattern of patterns[key]) {
        const match = cleanHtml.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          if (value && value.length > 2) {
            if (key === 'cnic') {
              result.cnic = formatCNIC(value);
            } else if (key === 'number') {
              result.number = formatNumber(value);
            } else {
              result[key] = value;
            }
            break;
          }
        }
      }
    });

    const tableRows = html.match(/<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi);
    if (tableRows) {
      tableRows.forEach(row => {
        const tdMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
        if (tdMatch) {
          const key = tdMatch[1].replace(/<[^>]*>/g, '').trim().toLowerCase();
          const value = tdMatch[2].replace(/<[^>]*>/g, '').trim();
          
          if (value && value.length > 2) {
            if (key.includes('name') || key.includes('full name')) {
              result.name = value;
            } else if (key.includes('cnic') || key.includes('nic') || key.includes('id')) {
              result.cnic = formatCNIC(value);
            } else if (key.includes('address') || key.includes('location')) {
              result.address = value;
            } else if (key.includes('mobile') || key.includes('phone') || key.includes('number')) {
              result.number = formatNumber(value);
            }
            result.raw_data.push({ label: key, value: value });
          }
        }
      });
    }

    const divData = html.match(/<div[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>[\s\S]*?([^<]+)<\/div>/gi);
    if (divData) {
      divData.forEach(div => {
        const match = div.match(/<strong>([^<]+)<\/strong>[\s\S]*?>([^<]+)</i);
        if (match) {
          const key = match[1].trim().toLowerCase();
          const value = match[2].trim();
          if (value && value.length > 2) {
            if (key.includes('name')) result.name = value;
            else if (key.includes('cnic')) result.cnic = formatCNIC(value);
            else if (key.includes('address')) result.address = value;
          }
        }
      });
    }

    if (result.name !== 'Not Found' || result.cnic !== 'Not Found' || result.address !== 'Not Found') {
      result.status = 'Success';
    }

    Object.keys(result).forEach(key => {
      if (typeof result[key] === 'string') {
        result[key] = result[key].replace(/[^\w\s\-.,()/]/g, '').trim();
        if (result[key] === '') result[key] = 'Not Found';
      }
    });

  } catch (e) {
    console.error('Parsing error:', e);
  }

  return result;
}

function formatCNIC(value) {
  let digits = value.replace(/[^0-9]/g, '');
  if (digits.length === 13) {
    return `${digits.slice(0,5)}-${digits.slice(5,12)}-${digits.slice(12)}`;
  }
  return value;
}

function formatNumber(value) {
  let digits = value.replace(/[^0-9]/g, '');
  if (digits.length === 11) {
    return digits;
  }
  return value;
}

function formatInput(value) {
  if (value.length === 13) {
    return formatCNIC(value);
  } else if (value.length === 11) {
    return value;
  }
  return value;
          }
