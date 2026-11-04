import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true, nullable: true })
  githubId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  githubLogin: string | null;

  /** Primary verified GitHub email, when the user has one. */
  @Column({ type: 'varchar', length: 191, unique: true, nullable: true })
  email: string | null;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
