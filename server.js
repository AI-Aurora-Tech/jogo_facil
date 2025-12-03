import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Logging middleware for Railway debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- API ROUTES ---

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: { subTeams: true, field: true }
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const userData = {
      ...user,
      field: undefined, 
      subTeams: user.subTeams || []
    };

    res.json(userData);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { subTeams, fieldData, ...userData } = req.body;

    const existing = await prisma.user.findUnique({ where: { email: userData.email } });
    if (existing) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          ...userData,
          subTeams: {
            create: subTeams || []
          }
        },
        include: { subTeams: true }
      });

      if (userData.role === 'FIELD_OWNER' && fieldData) {
        await tx.field.create({
          data: {
            ownerId: user.id,
            name: fieldData.name,
            location: fieldData.location,
            hourlyRate: fieldData.hourlyRate,
            cancellationFeePercent: fieldData.cancellationFeePercent,
            pixKey: fieldData.pixConfig.key,
            pixName: fieldData.pixConfig.name,
            imageUrl: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&q=80&w=1000',
            contactPhone: fieldData.contactPhone,
            latitude: -23.5505, 
            longitude: -46.6333
          }
        });
      }

      return user;
    });

    res.json(newUser);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erro ao criar conta: ' + error.message });
  }
});

// Update User
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { subTeams, ...data } = req.body;

    await prisma.subTeam.deleteMany({ where: { userId: id } });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        subTeams: {
          create: subTeams.map(t => ({ name: t.name, category: t.category }))
        }
      },
      include: { subTeams: true }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Get Fields
app.get('/api/fields', async (req, res) => {
  try {
    const fields = await prisma.field.findMany();
    const formattedFields = fields.map(f => ({
      ...f,
      pixConfig: { key: f.pixKey, name: f.pixName }
    }));
    res.json(formattedFields);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar campos' });
  }
});

// Get Slots
app.get('/api/slots', async (req, res) => {
  try {
    const slots = await prisma.matchSlot.findMany();
    res.json(slots);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar horários' });
  }
});

// Create Slots
app.post('/api/slots', async (req, res) => {
  try {
    const slotsData = req.body;
    if (!Array.isArray(slotsData)) return res.status(400).json({ error: 'Esperado array' });

    await prisma.matchSlot.createMany({
      data: slotsData
    });

    const allSlots = await prisma.matchSlot.findMany();
    res.json(allSlots);
  } catch (error) {
    console.error('Create slots error:', error);
    res.status(500).json({ error: 'Erro ao criar horários' });
  }
});

// Update Slot
app.put('/api/slots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.matchSlot.update({
      where: { id },
      data: req.body
    });
    res.json(updated);
  } catch (error) {
    console.error('Update slot error:', error);
    res.status(500).json({ error: 'Erro ao atualizar horário' });
  }
});

// Serve Frontend (Production)
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint não encontrado' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Rodando na porta ${PORT}`);
});