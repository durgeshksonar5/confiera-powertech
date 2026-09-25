/**
 * ==========================================================================
 * CONFIERA POWERTECH - SOLAR SAVINGS CALCULATOR ENGINE & CONTROLLER
 * Precision Solar Engineering & CRM Lead Management Integration
 * ==========================================================================
 */

(function() {
    "use strict";

    // --------------------------------------------------------------------------
    // 1. CONFIGURATION OBJECT
    // --------------------------------------------------------------------------
    const SOLAR_CONFIG = {
        panelWattage: 550,                 // 550W Monocrystalline PERC / TOPCon Tier-1 Modules
        panelAreaSqFt: 27.8,               // Physical area per 550W panel (~2.28m x 1.13m)
        roofUtilizationFactor: 0.70,       // 70% shadow-free usable rooftop factor
        performanceRatio: 0.80,            // 80% Performance Ratio (PR)
        defaultPeakSunHours: 5.0,          // Default peak sun hours (Maharashtra avg)
        pricePerKwTiered: function(kw) {   // Turnkey EPC cost per kW based on plant size
            if (kw <= 3) return 58000;
            if (kw <= 10) return 54000;
            if (kw <= 50) return 48000;
            return 44000;
        },
        calculateSubsidy: function(kw, customerType) {
            // PM Surya Ghar Muft Bijli Yojana Central Financial Assistance (Residential Only)
            if (customerType !== "Residential") return 0;
            if (kw <= 0) return 0;
            if (kw < 1.5) return 30000;
            if (kw < 2.5) return 60000;
            return 78000; // Cap at ₹78,000 for >= 3kW
        },
        co2EmissionFactorKgPerKwh: 0.82,    // CEA Grid emission factor (~0.82 kg CO2 / kWh)
        treesPerTonLifetime: 45,            // ~45 trees equivalent per ton CO2 lifetime
        degradationRate: 0.007,             // 0.7% annual solar degradation
        tariffEscalationRate: 0.03,         // 3% expected annual electricity tariff hike
        crmEndpoint: "https://leadsmanagment.hindustandigitalservices.com/api/forms/submit/0958a96f-a99b-4f47-b31f-18d20de492f8",
        whatsappNumber: "919156171235"
    };

    // --------------------------------------------------------------------------
    // 2. LOCATION DATASET (Indian States & Cities with Peak Sun Hours & Tariffs)
    // --------------------------------------------------------------------------
    const LOCATION_DATA = {
        "Maharashtra": {
            sunHours: 5.0,
            defaultTariff: 8.50,
            cities: ["Pune", "Mumbai", "Thane", "Navi Mumbai", "Nagpur", "Nashik", "Chhatrapati Sambhajinagar", "Kolhapur", "Solapur", "Sangli", "Satara", "Ahmednagar", "Jalgaon", "Amravati", "Nanded", "Akola", "Other Maharashtra City"]
        },
        "Gujarat": {
            sunHours: 5.4,
            defaultTariff: 7.50,
            cities: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar", "Junagadh", "Other Gujarat City"]
        },
        "Karnataka": {
            sunHours: 5.1,
            defaultTariff: 8.00,
            cities: ["Bengaluru", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi", "Kalaburagi", "Davanagere", "Ballari", "Other Karnataka City"]
        },
        "Delhi / NCR": {
            sunHours: 4.8,
            defaultTariff: 7.80,
            cities: ["New Delhi", "Noida", "Gurugram", "Faridabad", "Ghaziabad", "Greater Noida"]
        },
        "Rajasthan": {
            sunHours: 5.6,
            defaultTariff: 7.90,
            cities: ["Jaipur", "Jodhpur", "Kota", "Udaipur", "Bikaner", "Ajmer", "Bhilwara", "Alwar", "Other Rajasthan City"]
        },
        "Madhya Pradesh": {
            sunHours: 5.2,
            defaultTariff: 7.70,
            cities: ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Other MP City"]
        },
        "Tamil Nadu": {
            sunHours: 5.2,
            defaultTariff: 7.50,
            cities: ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode", "Other TN City"]
        },
        "Telangana": {
            sunHours: 5.1,
            defaultTariff: 8.00,
            cities: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Other Telangana City"]
        },
        "Andhra Pradesh": {
            sunHours: 5.2,
            defaultTariff: 7.60,
            cities: ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Tirupati", "Other AP City"]
        },
        "Uttar Pradesh": {
            sunHours: 4.9,
            defaultTariff: 7.50,
            cities: ["Lucknow", "Kanpur", "Varanasi", "Agra", "Prayagraj", "Meerut", "Bareilly", "Aligarh", "Other UP City"]
        },
        "Goa": {
            sunHours: 5.1,
            defaultTariff: 6.80,
            cities: ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"]
        },
        "Punjab & Haryana": {
            sunHours: 5.0,
            defaultTariff: 7.40,
            cities: ["Chandigarh", "Ludhiana", "Amritsar", "Jalandhar", "Karnal", "Panipat", "Ambala"]
        },
        "Kerala": {
            sunHours: 4.8,
            defaultTariff: 7.20,
            cities: ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam"]
        },
        "West Bengal": {
            sunHours: 4.7,
            defaultTariff: 7.90,
            cities: ["Kolkata", "Howrah", "Durgapur", "Siliguri", "Asansol"]
        },
        "Himachal Pradesh": {
            sunHours: 4.7,
            defaultTariff: 6.00,
            cities: ["Shimla", "Dharamshala", "Solan", "Mandi", "Kullu", "Baddi"]
        },
        "Other State / UT": {
            sunHours: 4.9,
            defaultTariff: 7.50,
            cities: ["Other City"]
        }
    };

    // --------------------------------------------------------------------------
    // 3. CORE CALCULATION ENGINE
    // --------------------------------------------------------------------------
    function calculateSolarSavings(inputs) {
        const {
            method,             // "bill" | "units" | "area"
            billAmount,         // in INR
            monthlyUnits,       // in kWh
            roofAreaSqFt,       // in sq.ft
            tariff,             // in INR/kWh
            state,
            city,
            customerType
        } = inputs;

        // Clean and safe tariff
        const safeTariff = Math.max(1, parseFloat(tariff) || 8.0);

        // Determine Sun Hours from state data
        const stateConfig = LOCATION_DATA[state] || { sunHours: SOLAR_CONFIG.defaultPeakSunHours };
        const peakSunHours = stateConfig.sunHours;
        const performanceRatio = SOLAR_CONFIG.performanceRatio;

        let derivedMonthlyUnits = 0;

        if (method === "bill") {
            const safeBill = Math.max(0, parseFloat(billAmount) || 0);
            derivedMonthlyUnits = safeBill > 0 ? (safeBill / safeTariff) : 0;
        } else if (method === "units") {
            derivedMonthlyUnits = Math.max(0, parseFloat(monthlyUnits) || 0);
        } else if (method === "area") {
            const safeArea = Math.max(0, parseFloat(roofAreaSqFt) || 0);
            // Effective shadow-free area available
            const usableArea = safeArea * SOLAR_CONFIG.roofUtilizationFactor;
            // Max panels that fit physically
            const maxPanels = Math.floor(usableArea / SOLAR_CONFIG.panelAreaSqFt);
            const potentialKw = (maxPanels * SOLAR_CONFIG.panelWattage) / 1000;
            // Potential monthly units generated
            derivedMonthlyUnits = potentialKw * (30 * peakSunHours * performanceRatio);
        }

        // Handle edge case / zero inputs
        if (derivedMonthlyUnits <= 0) {
            return null;
        }

        // Daily Consumption
        const dailyConsumption = derivedMonthlyUnits / 30;

        // Required System Size (kWp) = Monthly Consumption / (30 * Peak Sun Hours * Performance Ratio)
        const requiredSystemSize = derivedMonthlyUnits / (30 * peakSunHours * performanceRatio);

        // Panel Count (550W panels)
        const panelCount = Math.max(1, Math.ceil((requiredSystemSize * 1000) / SOLAR_CONFIG.panelWattage));

        // Actual System Capacity (kWp)
        const actualSystemCapacity = (panelCount * SOLAR_CONFIG.panelWattage) / 1000;

        // Daily Generation (kWh)
        const dailyGeneration = actualSystemCapacity * peakSunHours * performanceRatio;

        // Monthly Generation (kWh)
        const monthlyGeneration = dailyGeneration * 30;

        // Annual Generation (kWh)
        const annualGeneration = monthlyGeneration * 12;

        // 25-Year Cumulative Generation (taking 0.7% annual degradation into account)
        // Sum of (1 - 0.007 * y) for y=0 to 24 = 22.9 years equivalent
        const generation25Yr = annualGeneration * 22.9;

        // Annual Consumption
        const annualConsumption = derivedMonthlyUnits * 12;

        // Energy Offset %
        const energyOffsetPct = Math.min(100, Math.round((annualGeneration / annualConsumption) * 100)) || 100;

        // Financial Savings
        const annualSavings = annualGeneration * safeTariff;
        const monthlySavings = annualSavings / 12;

        // 25-Year Cumulative Financial Savings (accounting for 3% tariff escalation)
        const savings25Yr = annualSavings * 27.5;

        // System Cost & Subsidy
        const ratePerKw = SOLAR_CONFIG.pricePerKwTiered(actualSystemCapacity);
        const systemCost = Math.round(actualSystemCapacity * ratePerKw);
        const subsidy = SOLAR_CONFIG.calculateSubsidy(actualSystemCapacity, customerType);
        const netCost = Math.max(0, systemCost - subsidy);

        // Payback Period (Years)
        const paybackYears = annualSavings > 0 ? (netCost / annualSavings) : 0;

        // Annual ROI %
        const annualRoi = netCost > 0 ? ((annualSavings / netCost) * 100) : 0;

        // Environmental Impact
        const annualCo2Kg = annualGeneration * SOLAR_CONFIG.co2EmissionFactorKgPerKwh;
        const co2Reduction25YrTons = (generation25Yr * SOLAR_CONFIG.co2EmissionFactorKgPerKwh) / 1000;
        const treesEquivalentLifetime = Math.round(co2Reduction25YrTons * 1.6);

        // Estimated Shadow-Free Roof Area Required
        const estimatedRoofAreaSqFt = Math.round(panelCount * (SOLAR_CONFIG.panelAreaSqFt / SOLAR_CONFIG.roofUtilizationFactor));

        return {
            inputs: {
                method,
                billAmount: parseFloat(billAmount) || 0,
                monthlyUnits: Math.round(derivedMonthlyUnits),
                roofAreaSqFt: parseFloat(roofAreaSqFt) || 0,
                tariff: safeTariff,
                state,
                city,
                customerType,
                peakSunHours
            },
            results: {
                requiredSystemSize: parseFloat(requiredSystemSize.toFixed(2)),
                actualSystemCapacity: parseFloat(actualSystemCapacity.toFixed(2)),
                panelCount: panelCount,
                panelWattage: SOLAR_CONFIG.panelWattage,
                dailyGeneration: parseFloat(dailyGeneration.toFixed(1)),
                monthlyGeneration: Math.round(monthlyGeneration),
                annualGeneration: Math.round(annualGeneration),
                generation25Yr: Math.round(generation25Yr),
                monthlySavings: Math.round(monthlySavings),
                annualSavings: Math.round(annualSavings),
                savings25Yr: Math.round(savings25Yr),
                systemCost: systemCost,
                subsidy: subsidy,
                netCost: netCost,
                paybackYears: parseFloat(paybackYears.toFixed(1)),
                annualRoi: parseFloat(annualRoi.toFixed(1)),
                annualCo2Kg: Math.round(annualCo2Kg),
                co2Reduction25YrTons: parseFloat(co2Reduction25YrTons.toFixed(1)),
                treesEquivalentLifetime: treesEquivalentLifetime,
                estimatedRoofAreaSqFt: estimatedRoofAreaSqFt,
                energyOffsetPct: energyOffsetPct
            }
        };
    }

    // --------------------------------------------------------------------------
    // 4. NUMBER FORMATTING HELPERS
    // --------------------------------------------------------------------------
    function formatCurrencyINR(num) {
        if (!num || isNaN(num)) return "₹0";
        return "₹" + Number(num).toLocaleString("en-IN");
    }

    function formatNumberIN(num) {
        if (!num || isNaN(num)) return "0";
        return Number(num).toLocaleString("en-IN");
    }

    function formatLakhs(num) {
        if (!num || isNaN(num)) return "₹0";
        if (num >= 10000000) {
            return "₹" + (num / 10000000).toFixed(2) + " Cr";
        }
        if (num >= 100000) {
            return "₹" + (num / 100000).toFixed(2) + " L";
        }
        return formatCurrencyINR(num);
    }

    // --------------------------------------------------------------------------
    // 5. CENTRALIZED CRM API SUBMISSION FUNCTION
    // --------------------------------------------------------------------------
    window.submitLeadToCRM = async function(leadPayload) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(SOLAR_CONFIG.crmEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(leadPayload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response.ok || response.status === 200 || response.status === 201;
        } catch (err) {
            console.warn("ConfiEra CRM API Notice:", err.message);
            return false;
        }
    };

    // --------------------------------------------------------------------------
    // 6. SOLAR CALCULATOR UI CONTROLLER CLASS
    // --------------------------------------------------------------------------
    class SolarCalculatorController {
        constructor(wrapperElement) {
            this.wrapper = wrapperElement;
            this.currentMethod = "bill"; // "bill" | "units" | "area"
            this.currentCalculation = null;

            this.initDOM();
            this.populateDropdowns();
            this.bindEvents();
        }

        initDOM() {
            // Method Cards
            this.methodCards = this.wrapper.querySelectorAll(".solar-method-card");
            
            // Dynamic Input Wrappers
            this.inputBillWrap = this.wrapper.querySelector("#solarInputBillWrap");
            this.inputUnitsWrap = this.wrapper.querySelector("#solarInputUnitsWrap");
            this.inputAreaWrap = this.wrapper.querySelector("#solarInputAreaWrap");

            // Input fields
            this.billInput = this.wrapper.querySelector("#solarBillInput");
            this.unitsInput = this.wrapper.querySelector("#solarUnitsInput");
            this.areaInput = this.wrapper.querySelector("#solarAreaInput");

            // Location & Customer Dropdowns
            this.stateSelect = this.wrapper.querySelector("#solarStateSelect");
            this.citySelect = this.wrapper.querySelector("#solarCitySelect");
            this.categorySelect = this.wrapper.querySelector("#solarCategorySelect");

            // Tariff Controls
            this.tariffSlider = this.wrapper.querySelector("#solarTariffSlider");
            this.tariffInput = this.wrapper.querySelector("#solarTariffInput");
            this.tariffDisplay = this.wrapper.querySelector("#solarTariffVal");

            // Action & Error
            this.calcBtn = this.wrapper.querySelector("#solarCalculateBtn");
            this.errorBanner = this.wrapper.querySelector("#solarErrorBanner");
            this.errorText = this.wrapper.querySelector("#solarErrorText");

            // Report Container & Nodes
            this.reportContainer = this.wrapper.querySelector("#solarReportContainer");
            this.reportLocBadge = this.wrapper.querySelector("#solarReportLocBadge");
            this.plantSizeNode = this.wrapper.querySelector("#solarPlantSize");
            this.plantSizeNote = this.wrapper.querySelector("#solarPlantSizeNote");
            this.dailyGenNode = this.wrapper.querySelector("#solarDailyGen");
            this.sunHoursNode = this.wrapper.querySelector("#solarSunHours");

            // Generation Metrics
            this.genMonthlyNode = this.wrapper.querySelector("#solarGenMonthly");
            this.genAnnualNode = this.wrapper.querySelector("#solarGenAnnual");
            this.gen25YrNode = this.wrapper.querySelector("#solarGen25Yr");

            // Financial Savings Metrics
            this.saveMonthlyNode = this.wrapper.querySelector("#solarSaveMonthly");
            this.saveAnnualNode = this.wrapper.querySelector("#solarSaveAnnual");
            this.save25YrNode = this.wrapper.querySelector("#solarSave25Yr");
            this.savingsRateNote = this.wrapper.querySelector("#solarSavingsRateNote");

            // Cost & Subsidy Metrics
            this.costRowNode = this.wrapper.querySelector("#solarCostRow");
            this.subsidyRowNode = this.wrapper.querySelector("#solarSubsidyRow");
            this.netCostNode = this.wrapper.querySelector("#solarNetCost");
            this.paybackNode = this.wrapper.querySelector("#solarPayback");
            this.roiNode = this.wrapper.querySelector("#solarRoi");

            // Environmental & Roof Metrics
            this.envCo2Node = this.wrapper.querySelector("#solarEnvCo2");
            this.envTreesNode = this.wrapper.querySelector("#solarEnvTrees");
            this.envRoofNode = this.wrapper.querySelector("#solarEnvRoof");

            // Lead Form Elements
            this.leadForm = this.wrapper.querySelector("#solarLeadForm");
            this.leadName = this.wrapper.querySelector("#solarLeadName");
            this.leadPhone = this.wrapper.querySelector("#solarLeadPhone");
            this.leadEmail = this.wrapper.querySelector("#solarLeadEmail");
            this.leadSubmitBtn = this.wrapper.querySelector("#solarLeadSubmitBtn");
            this.leadSubmitText = this.wrapper.querySelector("#solarLeadSubmitText");
            this.leadSuccessBox = this.wrapper.querySelector("#solarLeadSuccess");
            this.leadErrorBox = this.wrapper.querySelector("#solarLeadApiError");

            // Share buttons
            this.shareWaBtn = this.wrapper.querySelector("#solarShareWa");
            this.shareEmailBtn = this.wrapper.querySelector("#solarShareEmail");
            this.sharePrintBtn = this.wrapper.querySelector("#solarSharePrint");
        }

        populateDropdowns() {
            if (!this.stateSelect) return;

            // Populate States
            this.stateSelect.innerHTML = `<option value="" disabled selected>Select State / UT</option>`;
            Object.keys(LOCATION_DATA).forEach(state => {
                const opt = document.createElement("option");
                opt.value = state;
                opt.textContent = state;
                if (state === "Maharashtra") {
                    opt.selected = true;
                }
                this.stateSelect.appendChild(opt);
            });

            this.updateCities("Maharashtra");
        }

        updateCities(state) {
            if (!this.citySelect) return;

            const stateData = LOCATION_DATA[state];
            if (!stateData) {
                this.citySelect.innerHTML = `<option value="" disabled selected>Select City</option>`;
                return;
            }

            this.citySelect.innerHTML = `<option value="" disabled selected>Select City</option>`;
            stateData.cities.forEach(city => {
                const opt = document.createElement("option");
                opt.value = city;
                opt.textContent = city;
                if (city === "Pune") {
                    opt.selected = true;
                }
                this.citySelect.appendChild(opt);
            });

            // Update default tariff if user hasn't explicitly customized it wildly
            if (stateData.defaultTariff && this.tariffSlider && this.tariffInput) {
                const val = stateData.defaultTariff.toFixed(2);
                this.tariffSlider.value = stateData.defaultTariff;
                this.tariffInput.value = val;
                this.updateTariffDisplay(stateData.defaultTariff);
            }
        }

        updateTariffDisplay(val) {
            const num = parseFloat(val) || 8.0;
            if (this.tariffDisplay) {
                this.tariffDisplay.textContent = `₹${num.toFixed(2)}`;
            }
            if (this.tariffSlider) {
                // Update slider gradient track
                const min = parseFloat(this.tariffSlider.min) || 1;
                const max = parseFloat(this.tariffSlider.max) || 25;
                const pct = ((num - min) / (max - min)) * 100;
                this.tariffSlider.style.background = `linear-gradient(to right, #3E8210 0%, #3E8210 ${pct}%, #E1EBE0 ${pct}%, #E1EBE0 100%)`;
            }
        }

        bindEvents() {
            // Method Card Switch
            this.methodCards.forEach(card => {
                card.addEventListener("click", () => {
                    const method = card.getAttribute("data-method");
                    this.switchMethod(method);
                });
            });

            // State Change
            if (this.stateSelect) {
                this.stateSelect.addEventListener("change", (e) => {
                    this.updateCities(e.target.value);
                    this.hideError();
                });
            }

            // Customer Category Change
            if (this.categorySelect) {
                this.categorySelect.addEventListener("change", () => {
                    this.hideError();
                });
            }

            // City Change
            if (this.citySelect) {
                this.citySelect.addEventListener("change", () => {
                    this.hideError();
                });
            }

            // Tariff Slider Input Sync
            if (this.tariffSlider && this.tariffInput) {
                this.tariffSlider.addEventListener("input", (e) => {
                    const val = parseFloat(e.target.value) || 8;
                    this.tariffInput.value = val.toFixed(2);
                    this.updateTariffDisplay(val);
                });

                this.tariffInput.addEventListener("input", (e) => {
                    let val = parseFloat(e.target.value);
                    if (isNaN(val) || val < 1) val = 1;
                    if (val > 30) val = 30;
                    this.tariffSlider.value = val;
                    this.updateTariffDisplay(val);
                });

                this.tariffInput.addEventListener("blur", (e) => {
                    let val = parseFloat(e.target.value);
                    if (isNaN(val) || val < 1) val = 1;
                    if (val > 30) val = 30;
                    this.tariffInput.value = val.toFixed(2);
                    this.updateTariffDisplay(val);
                });
            }

            // Tariff Quick Ticks Click
            const ticks = this.wrapper.querySelectorAll(".solar-slider-ticks span");
            ticks.forEach(tick => {
                tick.addEventListener("click", () => {
                    const val = parseFloat(tick.getAttribute("data-val"));
                    if (val && this.tariffSlider && this.tariffInput) {
                        this.tariffSlider.value = val;
                        this.tariffInput.value = val.toFixed(2);
                        this.updateTariffDisplay(val);
                    }
                });
            });

            // Calculate Button Click
            if (this.calcBtn) {
                this.calcBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    this.handleCalculate();
                });
            }

            // Lead Form Submission
            if (this.leadForm) {
                this.leadForm.addEventListener("submit", (e) => {
                    e.preventDefault();
                    this.handleLeadSubmit();
                });
            }

            // Share Actions
            if (this.shareWaBtn) {
                this.shareWaBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    this.shareOnWhatsApp();
                });
            }

            if (this.shareEmailBtn) {
                this.shareEmailBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    this.shareViaEmail();
                });
            }

            if (this.sharePrintBtn) {
                this.sharePrintBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    window.print();
                });
            }
        }

        switchMethod(method) {
            this.currentMethod = method;
            this.methodCards.forEach(c => {
                if (c.getAttribute("data-method") === method) {
                    c.classList.add("active");
                } else {
                    c.classList.remove("active");
                }
            });

            if (this.inputBillWrap) this.inputBillWrap.style.display = method === "bill" ? "block" : "none";
            if (this.inputUnitsWrap) this.inputUnitsWrap.style.display = method === "units" ? "block" : "none";
            if (this.inputAreaWrap) this.inputAreaWrap.style.display = method === "area" ? "block" : "none";

            this.hideError();
        }

        showError(msg) {
            if (this.errorBanner && this.errorText) {
                this.errorText.textContent = msg;
                this.errorBanner.classList.add("active");
                this.errorBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }

        hideError() {
            if (this.errorBanner) {
                this.errorBanner.classList.remove("active");
            }
        }

        handleCalculate() {
            this.hideError();

            const state = this.stateSelect ? this.stateSelect.value : "";
            const city = this.citySelect ? this.citySelect.value : "";
            const category = this.categorySelect ? this.categorySelect.value : "";
            const tariff = this.tariffInput ? parseFloat(this.tariffInput.value) : 8.0;

            if (!state || state === "Select State / UT") {
                this.showError("Please select your State / Union Territory.");
                return;
            }

            if (!category || category === "Select Category") {
                this.showError("Please select your Customer Category (Residential, Commercial, Industrial, etc.).");
                return;
            }

            if (!tariff || tariff <= 0) {
                this.showError("Please enter a valid electricity unit cost (₹/kWh).");
                return;
            }

            let bill = 0;
            let units = 0;
            let area = 0;

            if (this.currentMethod === "bill") {
                bill = parseFloat(this.billInput ? this.billInput.value : 0);
                if (isNaN(bill) || bill <= 0) {
                    this.showError("Please enter a valid monthly electricity bill amount (greater than ₹0).");
                    if (this.billInput) this.billInput.focus();
                    return;
                }
            } else if (this.currentMethod === "units") {
                units = parseFloat(this.unitsInput ? this.unitsInput.value : 0);
                if (isNaN(units) || units <= 0) {
                    this.showError("Please enter valid monthly electricity units (greater than 0 kWh).");
                    if (this.unitsInput) this.unitsInput.focus();
                    return;
                }
            } else if (this.currentMethod === "area") {
                area = parseFloat(this.areaInput ? this.areaInput.value : 0);
                if (isNaN(area) || area <= 0) {
                    this.showError("Please enter valid available rooftop area (greater than 0 sq.ft).");
                    if (this.areaInput) this.areaInput.focus();
                    return;
                }
            }

            const calculation = calculateSolarSavings({
                method: this.currentMethod,
                billAmount: bill,
                monthlyUnits: units,
                roofAreaSqFt: area,
                tariff: tariff,
                state: state,
                city: city,
                customerType: category
            });

            if (!calculation) {
                this.showError("Could not calculate solar savings for the given inputs. Please review your numbers.");
                return;
            }

            this.currentCalculation = calculation;
            this.renderReport(calculation);
        }

        renderReport(calc) {
            const { inputs, results } = calc;

            // Location badge
            if (this.reportLocBadge) {
                this.reportLocBadge.innerHTML = `<i class="ri-map-pin-2-fill"></i> <span>${inputs.city ? inputs.city + ", " : ""}${inputs.state}</span>`;
            }

            // Hero plant size
            if (this.plantSizeNode) {
                this.plantSizeNode.innerHTML = `${results.actualSystemCapacity} <span>kWp</span>`;
            }
            if (this.plantSizeNote) {
                let note = "";
                if (inputs.method === "bill") note = `Based on monthly bill of ${formatCurrencyINR(inputs.billAmount)}`;
                else if (inputs.method === "units") note = `Based on monthly consumption of ${formatNumberIN(inputs.monthlyUnits)} kWh`;
                else note = `Based on available roof area of ${formatNumberIN(inputs.roofAreaSqFt)} sq.ft`;
                this.plantSizeNote.textContent = note;
            }
            if (this.dailyGenNode) {
                this.dailyGenNode.textContent = `${results.dailyGeneration} kWh`;
            }
            if (this.sunHoursNode) {
                this.sunHoursNode.textContent = `${inputs.peakSunHours} hrs/day`;
            }

            // Electricity Generation Breakdown
            if (this.genMonthlyNode) this.genMonthlyNode.textContent = `${formatNumberIN(results.monthlyGeneration)} kWh`;
            if (this.genAnnualNode) this.genAnnualNode.textContent = `${formatNumberIN(results.annualGeneration)} kWh`;
            if (this.gen25YrNode) this.gen25YrNode.textContent = `${formatNumberIN(results.generation25Yr)} kWh`;

            // Financial Savings
            if (this.saveMonthlyNode) this.saveMonthlyNode.textContent = formatCurrencyINR(results.monthlySavings);
            if (this.saveAnnualNode) this.saveAnnualNode.textContent = formatCurrencyINR(results.annualSavings);
            if (this.save25YrNode) this.save25YrNode.textContent = formatLakhs(results.savings25Yr);
            if (this.savingsRateNote) this.savingsRateNote.textContent = `(at ₹${inputs.tariff.toFixed(2)}/kWh)`;

            // Cost & Subsidy
            if (this.costRowNode) {
                const label = results.subsidy > 0 ? "Estimated System Turnkey Cost" : "Estimated System Cost (Non-Subsidy)";
                this.costRowNode.innerHTML = `<span>${label}</span><span class="solar-cost-val">${formatLakhs(results.systemCost)}</span>`;
            }

            if (this.subsidyRowNode) {
                if (results.subsidy > 0) {
                    this.subsidyRowNode.style.display = "flex";
                    this.subsidyRowNode.innerHTML = `<span>Estimated Subsidy (PM Surya Ghar CFA)</span><span class="solar-cost-val" style="color:#2E7D32;">- ${formatCurrencyINR(results.subsidy)}</span>`;
                } else {
                    this.subsidyRowNode.style.display = "none";
                }
            }

            if (this.netCostNode) {
                this.netCostNode.textContent = formatLakhs(results.netCost);
            }

            if (this.paybackNode) {
                this.paybackNode.textContent = `${results.paybackYears} Yrs`;
            }

            if (this.roiNode) {
                this.roiNode.textContent = `${results.annualRoi}%`;
            }

            // Environmental & Roof
            if (this.envCo2Node) {
                this.envCo2Node.textContent = `${results.co2Reduction25YrTons} T`;
            }
            if (this.envTreesNode) {
                this.envTreesNode.textContent = `${formatNumberIN(results.treesEquivalentLifetime)}`;
            }
            if (this.envRoofNode) {
                this.envRoofNode.textContent = `${formatNumberIN(results.estimatedRoofAreaSqFt)} sq.ft`;
            }

            // Show report container and smooth scroll
            if (this.reportContainer) {
                this.reportContainer.classList.add("active");
                this.reportContainer.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }

        async handleLeadSubmit() {
            if (!this.currentCalculation) {
                this.showError("Please calculate your solar savings first before submitting.");
                return;
            }

            const nameInput = this.leadName;
            const phoneInput = this.leadPhone;
            const emailInput = this.leadEmail;

            const name = nameInput ? nameInput.value.trim() : "";
            const phone = phoneInput ? phoneInput.value.trim() : "";
            const email = emailInput ? emailInput.value.trim() : "";

            let isValid = true;

            const nameErr = this.wrapper.querySelector("#solarLeadNameErr");
            const phoneErr = this.wrapper.querySelector("#solarLeadPhoneErr");
            if (nameErr) nameErr.style.display = "none";
            if (phoneErr) phoneErr.style.display = "none";

            if (!name || name.length < 2) {
                if (nameErr) nameErr.style.display = "block";
                if (nameInput) nameInput.focus();
                isValid = false;
            }

            const cleanPhone = phone.replace(/[^0-9]/g, "");
            if (!phone || cleanPhone.length < 10) {
                if (phoneErr) phoneErr.style.display = "block";
                if (isValid && phoneInput) phoneInput.focus();
                isValid = false;
            }

            if (!isValid) return;

            // Double submission lock
            if (this.leadSubmitBtn) this.leadSubmitBtn.disabled = true;
            if (this.leadSubmitText) this.leadSubmitText.textContent = "Submitting Your Report...";
            if (this.leadErrorBox) this.leadErrorBox.classList.remove("active");

            // Identify Source
            const isHomePage = window.location.pathname.endsWith("index.html") || window.location.pathname === "/" || window.location.pathname === "";
            const leadSource = isHomePage ? "solar_calculator_homepage" : "solar_calculator_contact_page";

            const { inputs, results } = this.currentCalculation;

            // Construct structured, professional message body
            const structuredSummary = [
                "Solar Savings Calculator Lead",
                `Customer Type: ${inputs.customerType}`,
                `Location: ${inputs.city ? inputs.city + ", " : ""}${inputs.state}`,
                "",
                `Calculation Method: ${inputs.method.toUpperCase()}`,
                inputs.method === "bill" ? `Monthly Bill: ₹${inputs.billAmount}` : "",
                inputs.method === "units" ? `Monthly Units: ${inputs.monthlyUnits} kWh` : "",
                inputs.method === "area" ? `Available Roof Area: ${inputs.roofAreaSqFt} sq.ft` : "",
                `Electricity Tariff: ₹${inputs.tariff.toFixed(2)}/kWh`,
                `Peak Sun Hours: ${inputs.peakSunHours} hrs/day`,
                "",
                `Recommended System Size: ${results.actualSystemCapacity} kWp`,
                `Panels: ${results.panelCount} × ${results.panelWattage}W Monocrystalline`,
                `Estimated Daily Generation: ${results.dailyGeneration} kWh/day`,
                `Estimated Monthly Generation: ${results.monthlyGeneration} kWh/month`,
                `Estimated Annual Generation: ${results.annualGeneration} kWh/year`,
                "",
                `Estimated Monthly Savings: ₹${results.monthlySavings}`,
                `Estimated Annual Savings: ₹${results.annualSavings}`,
                `Estimated 25-Year Savings: ₹${results.savings25Yr}`,
                "",
                `Estimated System Cost: ₹${results.systemCost}`,
                results.subsidy > 0 ? `Estimated PM Surya Ghar Subsidy: ₹${results.subsidy}` : "Subsidy: ₹0 (Commercial/Industrial/Non-eligible)",
                `Estimated Net Investment: ₹${results.netCost}`,
                `Estimated Payback Period: ${results.paybackYears} Years`,
                `Annual ROI: ${results.annualRoi}%`,
                "",
                `CO₂ Reduction: ${results.co2Reduction25YrTons} Tons (25 yrs)`,
                `Estimated Roof Area Required: ${results.estimatedRoofAreaSqFt} sq.ft`
            ].filter(line => line !== "").join("\n");

            // Lead Payload containing type: "other", direct parameters + comprehensive message
            const leadPayload = {
                type: "other",
                name: name,
                phone: phone,
                email: email || "",
                message: structuredSummary,
                source: "solar_calculator",
                lead_source: leadSource,
                page_url: window.location.href,
                page_title: document.title,

                // Solar Calculator Parameters (CamelCase & SnakeCase for maximum CRM compatibility)
                calculationMethod: inputs.method,
                customerType: inputs.customerType,
                state: inputs.state,
                city: inputs.city || "",
                monthlyBill: inputs.billAmount,
                monthlyConsumption: inputs.monthlyUnits,
                electricityTariff: inputs.tariff,
                roofArea: inputs.roofAreaSqFt,

                recommendedSystemSize: results.actualSystemCapacity,
                panelWattage: results.panelWattage,
                panelCount: results.panelCount,
                monthlyGeneration: results.monthlyGeneration,
                annualGeneration: results.annualGeneration,
                monthlySavings: results.monthlySavings,
                annualSavings: results.annualSavings,
                systemCost: results.systemCost,
                subsidy: results.subsidy,
                netCost: results.netCost,
                paybackPeriod: results.paybackYears,
                co2Reduction: results.co2Reduction25YrTons,
                roofAreaRequired: results.estimatedRoofAreaSqFt,

                // Standard field mappings
                customer_type: inputs.customerType,
                calculation_method: inputs.method,
                monthly_bill: inputs.billAmount,
                monthly_units: inputs.monthlyUnits,
                electricity_tariff: inputs.tariff,
                recommended_system_kw: results.actualSystemCapacity,
                panel_count: results.panelCount,
                panel_wattage: results.panelWattage,
                monthly_generation_kwh: results.monthlyGeneration,
                annual_generation_kwh: results.annualGeneration,
                monthly_savings_inr: results.monthlySavings,
                annual_savings_inr: results.annualSavings,
                system_cost_inr: results.systemCost,
                subsidy_inr: results.subsidy,
                net_cost_inr: results.netCost,
                payback_years: results.paybackYears,
                co2_reduction_tons: results.co2Reduction25YrTons,
                roof_area_sqft: results.estimatedRoofAreaSqFt
            };

            const isSuccess = await window.submitLeadToCRM(leadPayload);

            if (this.leadSubmitBtn) this.leadSubmitBtn.disabled = false;
            if (this.leadSubmitText) this.leadSubmitText.textContent = "Get My Solar Report →";

            if (isSuccess) {
                if (this.leadSuccessBox) this.leadSuccessBox.classList.add("active");
                if (this.leadForm) this.leadForm.style.display = "none";
            } else {
                if (this.leadErrorBox) {
                    this.leadErrorBox.textContent = "Unable to submit your details right now. Please try again or reach out to us directly.";
                    this.leadErrorBox.classList.add("active");
                }
            }
        }

        shareOnWhatsApp() {
            if (!this.currentCalculation) return;
            const { inputs, results } = this.currentCalculation;
            const text = `Hello ConfiEra PowerTech,\nI estimated my solar savings on your website calculator:\n\n*Location:* ${inputs.city ? inputs.city + ", " : ""}${inputs.state}\n*Customer Category:* ${inputs.customerType}\n*Recommended System:* ${results.actualSystemCapacity} kWp (${results.panelCount} × 550W Panels)\n*Estimated Annual Generation:* ${formatNumberIN(results.annualGeneration)} kWh\n*Estimated Annual Savings:* ₹${formatNumberIN(results.annualSavings)}\n*Estimated Net Cost:* ₹${formatNumberIN(results.netCost)}\n*Estimated Payback:* ${results.paybackYears} Years\n\nPlease connect with me for a site survey and formal engineering proposal.`;
            const url = `https://wa.me/${SOLAR_CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`;
            window.open(url, "_blank");
        }

        shareViaEmail() {
            if (!this.currentCalculation) return;
            const { inputs, results } = this.currentCalculation;
            const subject = encodeURIComponent("Solar Savings Report - ConfiEra PowerTech");
            const body = encodeURIComponent(`Hi,\n\nHere is my Solar Savings Estimation:\n- Location: ${inputs.city ? inputs.city + ", " : ""}${inputs.state}\n- Recommended System: ${results.actualSystemCapacity} kWp\n- Estimated Annual Generation: ${results.annualGeneration} kWh\n- Estimated Annual Savings: ₹${results.annualSavings}\n- Estimated Net Investment: ₹${results.netCost}\n- Estimated Payback: ${results.paybackYears} Years\n\nGenerated via ConfiEra PowerTech Solar Calculator.`);
            window.location.href = `mailto:sales@confierapowertech.com?subject=${subject}&body=${body}`;
        }
    }

    // --------------------------------------------------------------------------
    // 7. INITIALIZE ALL SOLAR CALCULATORS ON PAGE
    // --------------------------------------------------------------------------
    function initSolarCalculators() {
        const calcWrappers = document.querySelectorAll(".solar-calculator-section, #solarCalculatorWrapper");
        calcWrappers.forEach(wrap => {
            if (!wrap.dataset.solarInit) {
                wrap.dataset.solarInit = "true";
                new SolarCalculatorController(wrap);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSolarCalculators);
    } else {
        initSolarCalculators();
    }
})();
