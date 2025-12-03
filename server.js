import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log para debug inicial
console.log("Iniciando servidor...");

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files from the React app build
app.use(express.static(path.join(__dirname, 'dist')));

// --- API ROUTES ---

// Health Check (Para o Railway saber que está vivo)
app.get('/health', (req, res) => res.send('OK'));

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { subTeams: true }
    });

    if (user && user.password === password) {
      const { password, ...userWithoutPass } = user;
      res.json(userWithoutPass);
    } else {
      res.status(401).json({ error: 'Credenciais inválidas' });
    }
  } catch (e) {
    console.error("Login Error:", e);
    res.status(500).json({ error: 'Erro no servidor ao fazer login.' });
  }
});

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
  const data = req.body;
  console.log("Tentativa de registro:", data.email, data.role);
  
  try {
    // 1. Check existing
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      console.log("Usuário já existe:", data.email);
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // 2. Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create User
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: data.password,
          name: data.name,
          role: data.role,
          phoneNumber: data.phoneNumber,
          subscription: data.subscription,
          subscriptionExpiry: data.subscriptionExpiry ? new Date(data.subscriptionExpiry) : null,
          latitude: data.latitude || -23.55,
          longitude: data.longitude || -46.63,
          subTeams: {
            create: data.subTeams?.map(t => ({ name: t.name, category: t.category })) || []
          }
        }
      });

      // Create Field if needed
      if (data.role === 'FIELD_OWNER' && data.fieldData) {
        console.log("Criando campo para usuário:", user.id);
        await tx.field.create({
          data: {
            name: data.fieldData.name,
            location: data.fieldData.location,
            hourlyRate: Number(data.fieldData.hourlyRate),
            cancellationFeePercent: Number(data.fieldData.cancellationFeePercent),
            pixKey: data.fieldData.pixConfig.key,
            pixName: data.fieldData.pixConfig.name,
            imageUrl: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=1470&auto=format&fit=crop', // Imagem padrão melhor
            contactPhone: data.fieldData.contactPhone,
            latitude: user.latitude || 0,
            longitude: user.longitude || 0,
            ownerId: user.id
          }
        });
      }

      return user;
    });

    console.log("Registro sucesso:", result.id);
    
    // 3. Return full object
    const { password, ...userWithoutPass } = result;
    const fullUser = await prisma.user.findUnique({
      where: { id: result.id },
      include: { subTeams: true }
    });
    
    res.json(fullUser);

  } catch (e) {
    console.error("Registration Critical Error:", e);
    // Retornar o erro exato ajuda a debugar
    res.status(500).json({ error: `Erro no banco de dados: ${e.message}` });
  }
});

// Update User
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phoneNumber, subTeams, subscription } = req.body;

  try {
    await prisma.user.update({
      where: { id },
      data: { name, phoneNumber, subscription }
    });

    await prisma.subTeam.deleteMany({ where: { userId: id } });
    if (subTeams && subTeams.length > 0) {
      await prisma.subTeam.createMany({
        data: subTeams.map(t => ({ name: t.name, category: t.category, userId: id }))
      });
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id },
      include: { subTeams: true }
    });
    res.json(updatedUser);
  } catch (e) {
    console.error("Update User Error:", e);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Get Fields
app.get('/api/fields', async (req, res) => {
  try {
    const fields = await prisma.field.findMany();
    const mapped = fields.map(f => ({
      ...f,
      pixConfig: { key: f.pixKey, name: f.pixName }
    }));
    res.json(mapped);
  } catch (e) {
    console.error("Get Fields Error:", e);
    res.status(500).json({ error: 'Erro ao buscar campos' });
  }
});

// Get Slots
app.get('/api/slots', async (req, res) => {
  try {
    const slots = await prisma.matchSlot.findMany();
    res.json(slots);
  } catch (e) {
    console.error("Get Slots Error:", e);
    res.status(500).json({ error: 'Erro ao buscar horários' });
  }
});

// Create Slots
app.post('/api/slots', async (req, res) => {
  const slotsData = req.body;
  try {
    await prisma.matchSlot.createMany({
      data: slotsData
    });
    const allSlots = await prisma.matchSlot.findMany();
    res.json(allSlots);
  } catch (e) {
    console.error("Create Slots Error:", e);
    res.status(500).json({ error: 'Erro ao criar horários' });
  }
});

// Update Slot
app.put('/api/slots/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const updated = await prisma.matchSlot.update({
      where: { id },
      data
    });
    res.json(updated);
  } catch (e) {
    console.error("Update Slot Error:", e);
    res.status(500).json({ error: 'Erro ao atualizar horário' });
  }
});

// Catch-all handler for React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});