const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/expenses
// @desc    Add a new expense
// @access  Private
router.post('/', protect, async (req, res) => {
  const { description, amount, category, date } = req.body;
  try {
    const expense = new Expense({ user: req.user._id, description, amount, category, date });
    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/expenses
// @desc    Get all expenses for a user, with optional date filtering
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { user: req.user._id };

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT /api/expenses/:id
// @desc    Update an expense
// @access  Private
router.put('/:id', protect, async (req, res) => {
  const { description, amount, category, date } = req.body;
  try {
    let expense = await Expense.findById(req.params.id);
    if (!expense || expense.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    expense.description = description || expense.description;
    expense.amount = amount || expense.amount;
    expense.category = category || expense.category;
    expense.date = date || expense.date;
    await expense.save();
    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete an expense
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense || expense.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Expense removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/expenses/summary
// @desc    Get a summary of expenses grouped by category
// @access  Private
router.get('/summary', protect, async (req, res) => {
  try {
    const summary = await Expense.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
    ]);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching expense summary:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/expenses/monthly
// @desc    Get monthly spending trends
// @access  Private
router.get('/monthly', protect, async (req, res) => {
  try {
    const monthlyTrends = await Expense.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          totalAmount: { $sum: '$amount' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ]);
    res.json(monthlyTrends);
  } catch (error) {
    console.error('Error fetching monthly trends:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/expenses/total
// @desc    Get total spending for a user within a date range
// @access  Private
router.get('/total', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { user: req.user._id };

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const totalSpending = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null, // Group all documents into a single group
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // totalSpending will be an array, e.g., [{ _id: null, totalAmount: 123.45 }]
    // We want to return just the number, or 0 if no expenses are found.
    const total = totalSpending.length > 0 ? totalSpending[0].totalAmount : 0;
    res.json({ total });
  } catch (error) {
    console.error('Error fetching total spending:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;