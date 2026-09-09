const axios = require('axios');

module.exports = async (req, res) => {
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

    // Clean input - remove all non-digits
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
      input: cleanQuery,
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
    status: 'Failed'
  };

  try {
    // Extract all text content
    const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract table data with better parsing
    const tableData = [];
    const tableMatches = html.match(/<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi);
    
    if (tableMatches) {
      tableMatches.forEach(row => {
        const tdMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
        if (tdMatch) {
          const key = tdMatch[1].replace(/<[^>]*>/g, '').trim();
          const value = tdMatch[2].replace(/<[^>]*>/g, '').trim();
          if (key && value) {
            tableData.push({ key: key.toLowerCase(), value: value });
          }
        }
      });
    }

    // Extract data from table
    tableData.forEach(item => {
      const key = item.key.toLowerCase();
      const value = item.value;
      
      if (value && value.length > 1) {
        // Name detection
        if (key.includes('name') || key.includes('full name') || key.includes('customer') || 
            key.includes('owner') || key.includes('holder') || key.includes('subscriber')) {
          if (!result.name || result.name === 'Not Found') {
            result.name = value;
          }
        }
        
        // CNIC detection
        if (key.includes('cnic') || key.includes('nic') || key.includes('id') || 
            key.includes('identification') || key.includes('identity')) {
          const cleanCNIC = value.replace(/[^0-9]/g, '');
          if (cleanCNIC.length === 13) {
            result.cnic = cleanCNIC;
          }
        }
        
        // Address detection
        if (key.includes('address') || key.includes('location') || key.includes('city') || 
            key.includes('district') || key.includes('province') || key.includes('area')) {
          if (!result.address || result.address === 'Not Found') {
            result.address = value;
          }
        }
        
        // Mobile number detection
        if (key.includes('mobile') || key.includes('phone') || key.includes('number') || 
            key.includes('contact') || key.includes('cell')) {
          const cleanNumber = value.replace(/[^0-9]/g, '');
          if (cleanNumber.length === 11 || cleanNumber.length === 10) {
            result.number = cleanNumber;
          }
        }
      }
    });

    // Try to find CNIC in text (13 digits)
    if (result.cnic === 'Not Found') {
      const cnicMatch = textContent.match(/\b[0-9]{13}\b/);
      if (cnicMatch) {
        result.cnic = cnicMatch[0];
      }
    }

    // Try to find mobile number in text (11 digits starting with 03)
    if (result.number === 'Not Found') {
      const numberMatch = textContent.match(/\b03[0-9]{9}\b/);
      if (numberMatch) {
        result.number = numberMatch[0];
      }
    }

    // Try to find name patterns
    if (result.name === 'Not Found') {
      const namePatterns = [
        /Name[:\s]+([A-Z\s]+)/i,
        /Customer[:\s]+([A-Z\s]+)/i,
        /Owner[:\s]+([A-Z\s]+)/i,
        /Subscriber[:\s]+([A-Z\s]+)/i,
        /Holder[:\s]+([A-Z\s]+)/i
      ];
      
      for (let pattern of namePatterns) {
        const match = textContent.match(pattern);
        if (match && match[1] && match[1].trim().length > 2) {
          result.name = match[1].trim();
          break;
        }
      }
    }

    // Try to find address patterns
    if (result.address === 'Not Found') {
      const addressPatterns = [
        /Address[:\s]+([A-Za-z0-9\s,.\-]+)/i,
        /Location[:\s]+([A-Za-z0-9\s,.\-]+)/i,
        /City[:\s]+([A-Za-z\s]+)/i,
        /District[:\s]+([A-Za-z\s]+)/i
      ];
      
      for (let pattern of addressPatterns) {
        const match = textContent.match(pattern);
        if (match && match[1] && match[1].trim().length > 2) {
          result.address = match[1].trim();
          break;
        }
      }
    }

    // Clean up - remove dashes from CNIC
    if (result.cnic !== 'Not Found') {
      result.cnic = result.cnic.replace(/[^0-9]/g, '');
    }

    // Clean up - remove dashes from number
    if (result.number !== 'Not Found') {
      result.number = result.number.replace(/[^0-9]/g, '');
    }

    // Check if we found any data
    if (result.name !== 'Not Found' || result.cnic !== 'Not Found' || 
        result.address !== 'Not Found' || result.number !== 'Not Found') {
      result.status = 'Success';
    }

  } catch (e) {
    console.error('Parsing error:', e);
  }

  return result;
}
